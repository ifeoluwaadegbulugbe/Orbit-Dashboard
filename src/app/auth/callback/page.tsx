"use client";

/**
 * /auth/callback — handles both Supabase auth redirect shapes:
 *
 *  1. PKCE flow   ?code=...&type=...   (exchangeCodeForSession)
 *  2. Implicit flow  #access_token=...  (setSession — used by Admin generateLink)
 *
 * The server-side route.ts handler couldn't see hash fragments, which caused
 * "missing_code" errors when the admin-generated recovery link was clicked.
 * A client component reads window.location.hash directly.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function handle() {
      // ── 1. PKCE code flow (?code= in search params) ───────────────────────
      const url    = new URL(window.location.href);
      const code   = url.searchParams.get("code");
      const type   = url.searchParams.get("type") ?? "";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const reason = error.message.toLowerCase().includes("expired")
            ? "link_expired"
            : "exchange_failed";
          router.replace(`/login?verifyError=${reason}`);
          return;
        }
        router.replace(destination(type));
        return;
      }

      // ── 2. Implicit / token flow (#access_token= in hash) ─────────────────
      // Used when Supabase Admin generateLink() is called — the verify
      // endpoint redirects here with tokens in the URL hash.
      const hash         = new URLSearchParams(window.location.hash.slice(1));
      const accessToken  = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const hashType     = hash.get("type") || type;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          router.replace("/login?verifyError=exchange_failed");
          return;
        }
        router.replace(destination(hashType));
        return;
      }

      // ── 3. Nothing usable ─────────────────────────────────────────────────
      router.replace("/login?verifyError=missing_code");
    }

    /** Map the Supabase `type` param to the correct next page. */
    function destination(type: string): string {
      if (type === "recovery")  return "/reset-password";
      if (type === "magiclink") return "/home";
      return "/welcome"; // signup / email verification
    }

    handle();
  }, [router]);

  // Brief loading state — user sees this for ~200ms before the redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin" />
        <p className="text-small text-[var(--color-ink-light)]">Signing you in…</p>
      </div>
    </div>
  );
}
