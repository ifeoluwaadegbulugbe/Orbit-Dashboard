"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

/* ─── Shared input style (matches login / signup pages) ─────────────────── */
const inputCls =
  "w-full h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white " +
  "text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] " +
  "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 " +
  "transition-colors";

interface FormValues {
  password: string;
  confirmPassword: string;
}

/**
 * Step 2 of password reset.
 *
 * The user arrived here from /auth/callback after clicking the reset link in
 * their email. The callback already established a recovery session, so
 * updateUser({ password }) will work immediately.
 *
 * If there's no valid session (link expired / used twice) we show a friendly
 * message with a link back to the login page's forgot-password flow.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [done, setDone]             = useState(false);
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, formState } = useForm<FormValues>();
  const password = watch("password", "");

  /* ── Check a recovery session is present ─────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    createClient().auth.getSession().then(({ data }) => {
      if (!cancelled) setHasSession(!!data.session);
    });
    return () => { cancelled = true; };
  }, []);

  /* ── Submit ───────────────────────────────────────────────────────────── */
  async function onSubmit(values: FormValues) {
    if (values.password !== values.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    try {
      const { error: err } = await createClient().auth.updateUser({
        password: values.password,
      });
      if (err) { setError(err.message); return; }

      // Sign out cleanly so the user re-authenticates with their new password
      await createClient().auth.signOut();
      setDone(true);
      setTimeout(() => router.replace("/login?reset=1"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    }
  }

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (hasSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)]">
        <div className="h-7 w-7 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  /* ── No session — link expired or already used ────────────────────────── */
  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-[var(--radius-xl)] bg-[var(--color-warning-light)] flex items-center justify-center">
            <Lock className="h-7 w-7 text-[var(--color-warning-deep)]" />
          </div>
          <h1 className="text-section font-bold text-[var(--color-ink)]">Link expired</h1>
          <p className="mt-2 text-small text-[var(--color-ink-light)] leading-relaxed">
            That reset link has expired or was already used.<br />
            Reset links are valid for 1 hour and can only be used once.
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-full bg-[var(--color-primary)] text-white text-small font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Request a new link
          </button>
        </div>
      </div>
    );
  }

  /* ── Success ──────────────────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-[var(--radius-xl)] bg-[var(--color-success-light)] flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-[var(--color-success-deep)]" />
          </div>
          <h1 className="text-section font-bold text-[var(--color-ink)]">Password updated!</h1>
          <p className="mt-2 text-small text-[var(--color-ink-light)]">
            Taking you to sign in with your new password…
          </p>
        </div>
      </div>
    );
  }

  /* ── Main form ────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4 py-12">
      <div className="w-full max-w-md">

        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8">

          {/* Header */}
          <div className="mb-7">
            <div className="w-12 h-12 mb-4 rounded-[var(--radius-xl)] bg-[var(--color-primary-subtle)] flex items-center justify-center">
              <Lock className="h-6 w-6 text-[var(--color-primary)]" />
            </div>
            <h1 className="text-section font-bold text-[var(--color-ink)]">Set new password</h1>
            <p className="mt-2 text-small text-[var(--color-ink-light)]">
              Pick something strong — you&apos;ll use it next time you sign in.
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-small">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* New password */}
            <div>
              <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  autoFocus
                  className={`${inputCls} pl-10 pr-11`}
                  {...register("password", { required: true, minLength: 8 })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink-light)] transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formState.errors.password?.type === "minLength" && (
                <p className="mt-1.5 text-tiny text-[var(--color-danger-deep)]">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Type it again"
                  autoComplete="new-password"
                  className={`${inputCls} pl-10 pr-11`}
                  {...register("confirmPassword", {
                    required: true,
                    validate: v => v === password || "Passwords don't match",
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink-light)] transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formState.errors.confirmPassword && (
                <p className="mt-1.5 text-tiny text-[var(--color-danger-deep)]">
                  {formState.errors.confirmPassword.message ?? "Required"}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" fullWidth loading={formState.isSubmitting}>
              Update password
            </Button>

          </form>
        </div>
      </div>
    </div>
  );
}
