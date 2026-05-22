"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Shown right after signup when Supabase has email confirmation enabled.
 * Tells the user to check their inbox + offers a resend button so they
 * don't have to start signup over if the email got lost.
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const search = useSearchParams();
  const email = search.get("email") ?? "";
  const warn = search.get("warn");                        // "email_send_failed" -> show banner
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend() {
    if (!email) return;
    setResendState("sending");
    setResendError(null);
    try {
      const supabase = createClient();
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${appUrl}/auth/callback` },
      });
      if (error) throw new Error(error.message);
      setResendState("sent");
    } catch (err) {
      setResendState("failed");
      setResendError(err instanceof Error ? err.message : "Could not resend");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-md p-8 sm:p-10">
          <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
            <Mail className="h-6 w-6 text-[var(--color-primary)]" />
          </div>

          <h1 className="text-center text-section font-bold tracking-tight">
            {warn === "email_send_failed" ? "Almost there" : "Check your inbox"}
          </h1>

          <p className="text-center mt-3 text-body text-[var(--color-ink-light)] leading-relaxed">
            {warn === "email_send_failed" ? (
              <>
                Your account was created, but the verification email didn&apos;t go through.
                That&apos;s usually a temporary rate-limit. Tap <strong>Resend</strong> below.
              </>
            ) : email ? (
              <>
                We sent a verification link to{" "}
                <strong className="text-[var(--color-ink)]">{email}</strong>.
                Click the link to finish setting up your Orbit account.
              </>
            ) : (
              <>We sent a verification link to your email. Click it to finish setting up Orbit.</>
            )}
          </p>

          {warn === "email_send_failed" && (
            <div className="mt-5 flex items-start gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-warning-light)] text-[var(--color-warning-deep)] text-tiny leading-relaxed">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Supabase&apos;s free email service is rate-limited to 3-4 emails per hour.
                If Resend fails too, wait 5 minutes or set up custom SMTP (see /help).
              </span>
            </div>
          )}

          <div className="mt-7 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-canvas)] text-tiny text-[var(--color-ink-light)] leading-relaxed">
            <p className="font-semibold text-[var(--color-ink)] mb-1">Not seeing it?</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Check spam / promotions folder</li>
              <li>Make sure the email above is right (typos happen)</li>
              <li>Tap &quot;Resend&quot; below to send a fresh one</li>
            </ul>
          </div>

          {/* Resend button */}
          <div className="mt-5 flex flex-col items-center gap-3">
            <button
              onClick={handleResend}
              disabled={!email || resendState === "sending" || resendState === "sent"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-small font-semibold transition-colors"
            >
              {resendState === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Resending...
                </>
              ) : resendState === "sent" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Sent again
                </>
              ) : (
                <>Resend verification email</>
              )}
            </button>

            {resendError && (
              <p className="text-small text-[var(--color-danger-deep)] text-center">{resendError}</p>
            )}
            {resendState === "sent" && (
              <p className="text-tiny text-[var(--color-success-deep)] text-center">
                Sent. Give it a minute and check spam if it still doesn&apos;t show up.
              </p>
            )}
          </div>

          <div className="mt-7 pt-6 border-t border-[var(--color-border)] flex items-center justify-between text-small">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 text-[var(--color-ink-light)] hover:text-[var(--color-ink)] font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Use a different email
            </Link>
            <Link href="/login" className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-semibold">
              I&apos;ve verified, sign in
            </Link>
          </div>
        </div>

        <p className="text-center text-tiny text-[var(--color-muted)] mt-6">
          Verification helps keep your business data safe.
        </p>
      </div>
    </div>
  );
}
