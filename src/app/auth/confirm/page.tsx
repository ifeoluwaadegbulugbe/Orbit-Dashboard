"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, MailCheck } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

const ALLOWED: EmailOtpType[] = ["signup", "magiclink", "email"];

/**
 * /auth/confirm?token_hash=...&type=signup - the link in the "Confirm your
 * email" message. The token is only used when the person taps the button,
 * so email scanners that open links can't confirm or burn it.
 */
export default function ConfirmEmailPage() {
  return <Suspense fallback={null}><ConfirmInner /></Suspense>;
}

function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenHash = params.get("token_hash") ?? "";
  const type = (params.get("type") ?? "signup") as EmailOtpType;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      if (!tokenHash || !ALLOWED.includes(type)) throw new Error("bad");
      const { error: err } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type });
      if (err) throw err;
      await fetch("/api/auth/confirmed", { method: "POST" }).catch(() => {});
      router.replace("/welcome");
      router.refresh();
    } catch {
      setError("This link has expired or was already used. Sign in, or ask for a new link.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-md p-8 sm:p-10 text-center">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
          <MailCheck className="h-6 w-6 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-section font-bold tracking-tight">Confirm your email</h1>
        <p className="mt-3 text-body text-[var(--color-ink-light)]">One tap and your Orbit account is ready.</p>
        {error ? (
          <>
            <p className="mt-6 text-small text-[var(--color-danger)]" role="alert">{error}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/login" className="text-small font-semibold text-[var(--color-primary)]">Sign in</Link>
              <Link href="/verify-email" className="text-small font-semibold text-[var(--color-primary)]">Send me a new link</Link>
            </div>
          </>
        ) : (
          <div className="mt-8">
            <Button fullWidth size="lg" onClick={confirm} loading={busy} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
              Confirm my email
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
