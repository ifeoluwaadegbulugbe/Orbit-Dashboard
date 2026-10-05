"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useCurrencyStore } from "@/stores/currencyStore";
import type { UserProfile } from "@/types";

/**
 * Offline support: the query cache (clients, bookings, invoices...) is saved
 * to this device so the last-loaded data still shows with no connection.
 * It belongs to one account: wiped on sign-out, and when a different user
 * signs in on the same browser.
 */
const CACHE_KEY = "orbit-query-cache";
const CACHE_OWNER_KEY = "orbit-query-cache-owner";
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function clearPersistedCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_OWNER_KEY);
  } catch {
    // storage blocked - nothing persisted anyway
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            // Must be >= the persisted age, or restored data is dropped immediately.
            gcTime: CACHE_MAX_AGE,
            refetchOnWindowFocus: false,
            retry: 1,
            // Offline: show cached data instead of erroring.
            networkMode: "offlineFirst",
          },
        },
      }),
  );
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: CACHE_KEY,
      throttleTime: 2000,
    }),
  );

  /** Drop another account's cached data the moment we know who's signed in. */
  function claimCacheFor(userId: string) {
    try {
      const owner = localStorage.getItem(CACHE_OWNER_KEY);
      if (owner && owner !== userId) {
        queryClient.clear();
        clearPersistedCache();
      }
      localStorage.setItem(CACHE_OWNER_KEY, userId);
    } catch {
      // ignore
    }
  }

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
          claimCacheFor(user.id);
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
        queryClient.clear();
        clearPersistedCache();
        navigator.serviceWorker?.controller?.postMessage("orbit:clear-cache");
      } else if (u) {
        claimCacheFor(u.id);
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

  // Offline app shell. Production only - in dev it would serve stale builds.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.warn("[Orbit] service worker registration failed:", err);
    });
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: "v1" }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
