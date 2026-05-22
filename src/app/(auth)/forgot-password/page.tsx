"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface FormValues {
  email: string;
}

/**
 * Step 1 of the password-reset flow.
 *
 * Asks for the email, calls supabase.auth.resetPasswordForEmail() which sends
 * the user a Supabase-templated email with a recovery link. That link routes
 * back to /auth/callback?type=recovery, which lands them on /reset-password
 * where they set a new password.
 *
 * Always shows the "check your inbox" success state - even if the email
 * doesn't exist - so attackers can't probe for valid accounts.
 */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, getValues } = useForm<FormValues>();

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const supabase = createClient();
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error: err } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${appUrl}/auth/callback?type=recovery`,
      });
      // Even on error, we show success to avoid leaking which emails are real
      if (err) console.warn("[forgot-password] reset request error:", err.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    }
  }

  if (sent) {
    return (
      <div>
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-[var(--color-primary)]" />
          </div>
          <h1 className="text-section font-bold text-[var(--color-ink)]">Check your inbox</h1>
          <p className="mt-3 text-lead text-[var(--color-ink-light)]">
            If <strong className="text-[var(--color-ink)]">{getValues("email")}</strong> matches an
            Orbit account, we just sent you a password reset link.
          </p>
        </div>

        <div className="bg-white p-7 rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm space-y-4">
          <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-canvas)] text-tiny text-[var(--color-ink-light)] leading-relaxed">
            <p className="font-semibold text-[var(--color-ink)] mb-1">Not seeing it?</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Check spam / promotions folder</li>
              <li>Wait 60 seconds (Supabase sometimes throttles)</li>
              <li>Make sure you used the right email address</li>
            </ul>
          </div>

          <button
            onClick={() => setSent(false)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Try a different email
          </button>
        </div>

        <p className="text-center mt-6 text-small">
          <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-section font-bold text-[var(--color-ink)]">Forgot your password?</h1>
        <p className="mt-3 text-lead text-[var(--color-ink-light)]">
          No worries. We&apos;ll email you a link to reset it.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white p-8 rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm">
        <Input
          label="Email"
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          {...register("email", { required: true })}
        />

        <Button type="submit" size="lg" fullWidth loading={formState.isSubmitting}>
          Send reset link
        </Button>

        <p className="text-center text-sm text-[var(--color-ink-light)] pt-1">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
