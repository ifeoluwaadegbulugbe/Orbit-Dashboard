"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useCurrencyStore } from "@/stores/currencyStore";
import type { UserProfile } from "@/types";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const { setUser, setProfile, setLoading, reset } = useAuthStore();
  const hydrateCurrency = useCurrencyStore((s) => s.hydrateFromCode);

  useEffect(() => {
    const supabase = createClient();
    // Guards against a stale async result winning a race against a newer
    // one - e.g. React Strict Mode double-invoking this effect in dev (each
    // invocation fires its own getUser() + onAuthStateChange "INITIAL_SESSION"
    // pair), or two profile fetches simply resolving out of order. Without
    // this, an in-flight fetch from a torn-down effect instance can call
    // setProfile() after a newer, correct one already did - silently
    // reverting the UI to a stale profile with no error anywhere.
    let cancelled = false;

    // Hydrate from current session - wrap in catch so DNS / network errors
    // don't break the whole app shell. The middleware logs a clear message.
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (cancelled) return;
        setUser(user);
        if (user) {
          loadProfile(user.id).then((p) => { if (!cancelled) setProfile(p); });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Most commonly: Supabase URL typo → DNS resolution failure
        console.warn("[Orbit] Could not reach Supabase from the browser.", err?.message ?? err);
        setUser(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Track auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      const u = session?.user ?? null;
      setUser(u);
      if (event === "SIGNED_OUT") {
        reset();
      } else if (u) {
        loadProfile(u.id).then((p) => { if (!cancelled) setProfile(p); });
      }
    });

    async function loadProfile(userId: string): Promise<UserProfile | null> {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        const profile = (data as (UserProfile & { country_code?: string | null; timezone?: string | null }) | null) ?? null;
        // Sync currency from profile so the user sees the same symbol they
        // picked on mobile (or on a different web browser).
        if (profile?.country_code) {
          hydrateCurrency(profile.country_code);
        }
        // Best-effort: capture the browser's real IANA timezone once, so
        // Google Calendar sync (and anything else time-sensitive) doesn't
        // have to guess from country alone. Never blocks, never surfaces
        // an error - if it fails, the country-based guess is still there.
        if (profile && !profile.timezone) {
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) {
              supabase.from("profiles").update({ timezone: tz }).eq("id", userId).then(() => {});
            }
          } catch {
            // Intl unsupported or write failed - ignore, not worth surfacing
          }
        }
        return profile;
      } catch {
        // Network / DNS errors fall through silently - user is treated as having no profile
        return null;
      }
    }

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
