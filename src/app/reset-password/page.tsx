"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Lock, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface FormValues {
  password: string;
  confirmPassword: string;
}

/**
 * Step 2 of password reset. The user arrived here from clicking the link in
 * their email (Supabase routes them through /auth/callback?type=recovery
 * first, which exchanges the code for a temporary session, then redirects
 * here). They set a new password and we drop them back at /login.
 *
 * If they hit this page without a recovery session (e.g. opened the link
 * twice), we kick them to /forgot-password to try again.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState } = useForm<FormValues>();

  // Verify there's a recovery session attached to this browser. Without it,
  // calling updateUser() would silently fail.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(!!data.session);
    });
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(values: FormValues) {
    setError(null);
    if (values.password !== values.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (values.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password: values.password });
      if (err) throw new Error(err.message);
      // Log out cleanly so they re-sign-in with the new password
      await supabase.auth.signOut();
      router.replace("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    }
  }

  // Loading state while we figure out session
  if (hasSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)]">
        <div className="text-small text-[var(--color-ink-light)]">Loading...</div>
      </div>
    );
  }

  // No session - link was invalid/expired
  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-md p-8 sm:p-10 text-center">
          <h1 className="text-section font-bold tracking-tight">Reset link expired</h1>
          <p className="mt-3 text-body text-[var(--color-ink-light)] leading-relaxed">
            That password reset link is no longer valid. Links work once and expire after an hour.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block mt-6 px-6 py-3 rounded-full bg-[var(--color-primary)] text-white text-small font-semibold hover:bg-[var(--color-primary-dark)]"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
            <Lock className="h-7 w-7 text-[var(--color-primary)]" />
          </div>
          <h1 className="text-section font-bold text-[var(--color-ink)]">Set a new password</h1>
          <p className="mt-3 text-lead text-[var(--color-ink-light)]">
            Pick something strong. You&apos;ll use this next time you sign in.
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white p-8 rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm">
          <Input
            label="New password"
            type="password"
            icon={<Lock className="h-4 w-4" />}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            autoFocus
            {...register("password", { required: true, minLength: 8 })}
          />
          <Input
            label="Confirm new password"
            type="password"
            icon={<CheckCircle2 className="h-4 w-4" />}
            placeholder="Type it again"
            autoComplete="new-password"
            {...register("confirmPassword", {
              required: true,
              validate: (v) => v === watch("password") || "Passwords don't match",
            })}
          />

          <Button type="submit" size="lg" fullWidth loading={formState.isSubmitting}>
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
