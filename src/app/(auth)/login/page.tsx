"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

/* ─── Shared input style ──────────────────────────────────────────────────────
   Height, radius, border, focus ring — all use the app's design tokens.       */
const inputCls =
  "w-full h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white " +
  "text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] " +
  "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 " +
  "transition-colors";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface SignInValues { email: string; password: string; remember: boolean }
interface ForgotValues { resetEmail: string }
type Mode = "signin" | "forgot" | "sent";

/* ─── Page shell (needs Suspense for useSearchParams) ───────────────────── */
export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}

function LoginInner() {
  const router      = useRouter();
  const search      = useSearchParams();
  const signedUp    = search.get("signedUp") === "1";
  const verifyError = search.get("verifyError");
  const wasReset    = search.get("reset") === "1";

  const [mode, setMode]       = useState<Mode>("signin");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Resend state
  const [resendBusy, setResendBusy]       = useState(false);
  const [resendDone, setResendDone]       = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds left

  /* ── Countdown timer for resend cooldown ─────────────────────────────── */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  /* ── Core: send (or resend) the reset email ──────────────────────────── */
  const sendReset = useCallback(async (email: string): Promise<boolean> => {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    const { error: e } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?type=recovery`,
    });
    if (e) {
      console.error("[reset-password]", e.message);
      return false;
    }
    return true;
  }, []);

  /* ── Sign-in ──────────────────────────────────────────────────────────── */
  const signInForm = useForm<SignInValues>({ defaultValues: { remember: false } });

  async function onSignIn(values: SignInValues) {
    setError(null);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: values.email, password: values.password,
      });
      if (error) { setError(friendly(error.message)); return; }
      router.replace("/home");
      router.refresh();
    } catch (e) { setError(friendly(e instanceof Error ? e.message : String(e))); }
  }

  /* ── Forgot password ─────────────────────────────────────────────────── */
  const forgotForm = useForm<ForgotValues>();
  const sentEmail  = forgotForm.watch("resetEmail");

  async function onForgot(values: ForgotValues) {
    setError(null);
    try {
      const ok = await sendReset(values.resetEmail);
      if (!ok) {
        setError("Couldn't send the reset email. Check your email address and try again.");
        return;
      }
      setResendCooldown(60); // 60-second cooldown before first resend
      setResendDone(false);
      setMode("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset email");
    }
  }

  /* ── Resend from the confirmation screen ────────────────────────────── */
  async function onResend() {
    if (!sentEmail || resendBusy || resendCooldown > 0) return;
    setResendBusy(true);
    setResendDone(false);
    try {
      const ok = await sendReset(sentEmail);
      if (ok) {
        setResendDone(true);
        setResendCooldown(60);
      } else {
        setError("Couldn't resend the email. Try again in a moment.");
      }
    } catch {
      setError("Couldn't resend the email. Try again in a moment.");
    } finally {
      setResendBusy(false);
    }
  }

  /* ── Friendly error copy ─────────────────────────────────────────────── */
  function friendly(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid path") || m.includes("not found"))
      return "Can't reach the auth service. Check NEXT_PUBLIC_SUPABASE_URL in your environment settings.";
    if (m.includes("fetch failed") || m.includes("network"))
      return "Network error — check your connection and try again.";
    if (m.includes("invalid api key"))
      return "Auth service misconfigured. Contact support.";
    if (m.includes("invalid login credentials"))
      return "Email or password is incorrect. Try again or reset your password below.";
    return msg;
  }

  /* ── Reusable banner strip ───────────────────────────────────────────── */
  function Banners() {
    return (
      <>
        {signedUp && (
          <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-small">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Account created! Sign in to continue.
          </div>
        )}
        {wasReset && (
          <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-small">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Password updated. Sign in with your new password.
          </div>
        )}
        {verifyError && (
          <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-warning-light)] text-[var(--color-warning-deep)] text-small">
            {verifyError === "link_expired"
              ? "That link has expired. Sign in or request a fresh reset email."
              : verifyError === "missing_code"
                ? "That link looks incomplete — try clicking it again from your email."
                : "We couldn't verify that link. Request a new one or contact support."}
          </div>
        )}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-small">
            {error}
          </div>
        )}
      </>
    );
  }

  /* ══ "Check your inbox" ══════════════════════════════════════════════════ */
  if (mode === "sent") return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-[var(--radius-xl)] bg-[var(--color-primary-subtle)] flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-section font-bold text-[var(--color-ink)]">Check your inbox</h1>
        <p className="mt-2 text-small text-[var(--color-ink-light)]">
          A reset link was sent to{" "}
          <strong className="text-[var(--color-ink)]">{sentEmail}</strong>.
        </p>
      </div>

      {/* Error from resend attempt */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-small">
          {error}
        </div>
      )}

      {/* Resend success confirmation */}
      {resendDone && !error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-small">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Reset link resent — check your inbox again.
        </div>
      )}

      {/* Resend button */}
      <button
        onClick={onResend}
        disabled={resendBusy || resendCooldown > 0}
        className="w-full flex items-center justify-center gap-2 h-11 mb-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white text-small font-semibold text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`h-4 w-4 ${resendBusy ? "animate-spin" : ""}`} />
        {resendBusy
          ? "Sending…"
          : resendCooldown > 0
            ? `Resend reset link (${resendCooldown}s)`
            : "Resend reset link"}
      </button>

      {/* Didn't get it tips */}
      <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-canvas)] text-tiny text-[var(--color-ink-light)] leading-relaxed mb-4">
        <p className="font-semibold text-[var(--color-ink)] mb-1">Not seeing it?</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Check your spam or promotions folder</li>
          <li>Make sure you used the correct email address</li>
          <li>Wait a moment — delivery can take up to 60 seconds</li>
        </ul>
      </div>

      <button
        onClick={() => { setMode("forgot"); forgotForm.reset(); setError(null); }}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-small text-[var(--color-ink-light)] hover:text-[var(--color-ink)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Try a different email
      </button>
      <button
        onClick={() => { setMode("signin"); setError(null); }}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </button>
    </div>
  );

  /* ══ Forgot-password form ════════════════════════════════════════════════ */
  if (mode === "forgot") return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8">
      <div className="mb-7">
        <h1 className="text-section font-bold text-[var(--color-ink)]">Reset password</h1>
        <p className="mt-2 text-small text-[var(--color-ink-light)]">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-small">
          {error}
        </div>
      )}

      <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-5">
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              className={`${inputCls} pl-10`}
              {...forgotForm.register("resetEmail", { required: true })}
            />
          </div>
        </div>

        <Button type="submit" size="lg" fullWidth loading={forgotForm.formState.isSubmitting}>
          Send reset link
        </Button>

        <button
          type="button"
          onClick={() => { setMode("signin"); setError(null); }}
          className="w-full flex items-center justify-center gap-1.5 pt-1 text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </button>
      </form>
    </div>
  );

  /* ══ Main sign-in card ═══════════════════════════════════════════════════ */
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8">

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-section font-bold text-[var(--color-ink)]">Sign In</h1>
        <p className="mt-2 text-small text-[var(--color-ink-light)]">Welcome back! Please enter your details.</p>
      </div>

      <Banners />

      <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-5">

        {/* Email */}
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
            <input
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              className={`${inputCls} pl-10`}
              {...signInForm.register("email", { required: true })}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
            <input
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className={`${inputCls} pl-10 pr-11`}
              {...signInForm.register("password", { required: true })}
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
        </div>

        {/* Remember + Forgot */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-primary)] accent-[var(--color-primary)] cursor-pointer"
              {...signInForm.register("remember")}
            />
            <span className="text-small text-[var(--color-ink-light)]">Remember for 30 Days</span>
          </label>
          <button
            type="button"
            onClick={() => { setMode("forgot"); setError(null); }}
            className="text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
          >
            Forgot password
          </button>
        </div>

        <Button type="submit" size="lg" fullWidth loading={signInForm.formState.isSubmitting}>
          Sign in
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-small text-[var(--color-ink-light)] mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors">
          Sign up free
        </Link>
      </p>
    </div>
  );
}
