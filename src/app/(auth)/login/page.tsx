"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Mail, Lock, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface SignInValues {
  email: string;
  password: string;
}
interface ForgotValues {
  resetEmail: string;
}

type Mode = "signin" | "forgot" | "sent";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const signedUp = search.get("signedUp") === "1";
  const verifyError = search.get("verifyError");
  const reset = search.get("reset") === "1";

  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);

  // ── Sign-in form ─────────────────────────────────────────────────────────
  const signInForm = useForm<SignInValues>();

  async function onSignIn(values: SignInValues) {
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setError(friendlyError(error.message));
        return;
      }
      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
    }
  }

  // ── Forgot-password form ─────────────────────────────────────────────────
  const forgotForm = useForm<ForgotValues>();
  const sentEmail = forgotForm.watch("resetEmail");

  async function onForgot(values: ForgotValues) {
    setError(null);
    try {
      const supabase = createClient();
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        values.resetEmail,
        { redirectTo: `${appUrl}/auth/callback?type=recovery` },
      );
      if (err) console.warn("[forgot-password]", err.message);
      setMode("sent"); // always show success to avoid email enumeration
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    }
  }

  function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid path") || m.includes("not found"))
      return "Can't reach Supabase. Your NEXT_PUBLIC_SUPABASE_URL in .env.local looks wrong — copy it again from Supabase Dashboard → Settings → API → Project URL, then restart the dev server.";
    if (m.includes("fetch failed") || m.includes("network"))
      return "Network error — couldn't reach Supabase. Check your internet and that your Supabase URL is correct.";
    if (m.includes("invalid api key"))
      return "Your Supabase anon key is wrong or doesn't match the project URL. Copy both from Settings → API.";
    if (m.includes("invalid login credentials"))
      return "Email or password doesn't match any account. Sign up if you haven't yet.";
    return msg;
  }

  // ── "Check your inbox" state ─────────────────────────────────────────────
  if (mode === "sent") {
    return (
      <div>
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-[var(--color-primary)]" />
          </div>
          <h1 className="text-section font-bold text-[var(--color-ink)]">Check your inbox</h1>
          <p className="mt-3 text-lead text-[var(--color-ink-light)]">
            If <strong className="text-[var(--color-ink)]">{sentEmail}</strong> matches an
            Orbit account, a password reset link is on its way.
          </p>
        </div>

        <div className="bg-white p-7 rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm space-y-4">
          <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-canvas)] text-tiny text-[var(--color-ink-light)] leading-relaxed">
            <p className="font-semibold text-[var(--color-ink)] mb-1">Not seeing it?</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Check your spam / promotions folder</li>
              <li>Wait 60 seconds — Supabase sometimes throttles</li>
              <li>Make sure you used the right email address</li>
            </ul>
          </div>
          <button
            onClick={() => { setMode("forgot"); forgotForm.reset(); }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Try a different email
          </button>
        </div>

        <p className="text-center mt-6 text-small">
          <button
            onClick={() => setMode("signin")}
            className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </button>
        </p>
      </div>
    );
  }

  // ── Forgot-password form ─────────────────────────────────────────────────
  if (mode === "forgot") {
    return (
      <div>
        <div className="text-center mb-10">
          <h1 className="text-section font-bold text-[var(--color-ink)]">Reset your password</h1>
          <p className="mt-3 text-lead text-[var(--color-ink-light)]">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={forgotForm.handleSubmit(onForgot)}
          className="space-y-5 bg-white p-8 rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm"
        >
          <Input
            label="Email"
            type="email"
            icon={<Mail className="h-4 w-4" />}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            {...forgotForm.register("resetEmail", { required: true })}
          />

          <Button type="submit" size="lg" fullWidth loading={forgotForm.formState.isSubmitting}>
            Send reset link
          </Button>

          <p className="text-center text-sm text-[var(--color-ink-light)] pt-1">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); }}
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </button>
          </p>
        </form>
      </div>
    );
  }

  // ── Sign-in form (default) ───────────────────────────────────────────────
  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-section font-bold text-[var(--color-ink)]">Welcome back</h1>
        <p className="mt-3 text-lead text-[var(--color-ink-light)]">Sign in to keep growing your business.</p>
      </div>

      {signedUp && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Account created! Sign in to continue.
        </div>
      )}

      {reset && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Password updated. Sign in with your new password.
        </div>
      )}

      {verifyError && (
        <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-warning-light)] text-[var(--color-warning-deep)] text-sm">
          {verifyError === "link_expired"
            ? "That verification link has expired. Sign in if you've already verified, or request a fresh email."
            : verifyError === "missing_code"
              ? "That link looks incomplete. Try clicking it again from your email, or request a new one."
              : "We couldn't verify that link. Try requesting a new one or contact support."}
        </div>
      )}

      {error && (
        <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={signInForm.handleSubmit(onSignIn)}
        className="space-y-5 bg-white p-8 rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm"
      >
        <Input
          label="Email"
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          autoComplete="email"
          {...signInForm.register("email", { required: true })}
        />
        <Input
          label="Password"
          type="password"
          icon={<Lock className="h-4 w-4" />}
          placeholder="Your password"
          autoComplete="current-password"
          {...signInForm.register("password", { required: true })}
        />

        <Button type="submit" size="lg" fullWidth loading={signInForm.formState.isSubmitting}>
          Sign in
        </Button>

        <p className="text-center text-sm text-[var(--color-ink-light)] pt-1">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
            Sign up free
          </Link>
        </p>
      </form>

      {/* Security section */}
      <div className="mt-4 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-[var(--color-border-light)]">
          <span className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)]">Security</span>
        </div>
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-canvas)] flex items-center justify-center flex-shrink-0">
            <KeyRound className="h-4 w-4 text-[var(--color-ink-light)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-small font-semibold text-[var(--color-ink)]">Password</div>
            <div className="text-tiny text-[var(--color-muted)]">Update your sign-in password</div>
          </div>
          <button
            type="button"
            onClick={() => { setMode("forgot"); setError(null); }}
            className="flex-shrink-0 text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
}
