"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

/* ─── Shared input style ──────────────────────────────────────────────────────
   Height, radius, border, focus ring — all use the app's design tokens.       */
const inputCls =
  "w-full h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white " +
  "text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] " +
  "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 " +
  "transition-colors";

/* ─── Google SVG ─────────────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.092 17.64 11.784 17.64 9.2Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

/* ─── Apple SVG ──────────────────────────────────────────────────────────── */
function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="var(--color-ink)" aria-hidden>
      <path d="M14.045 9.77c-.021-2.03 1.657-3.013 1.732-3.06-.944-1.38-2.41-1.57-2.934-1.59-1.249-.127-2.44.737-3.072.737-.632 0-1.604-.72-2.637-.7-1.356.02-2.61.79-3.307 2.007-1.413 2.447-.362 6.075.999 8.063.668.963 1.462 2.042 2.503 2.003 1.006-.04 1.385-.648 2.601-.648 1.216 0 1.556.648 2.618.626 1.083-.018 1.766-.977 2.425-1.944.773-1.113 1.09-2.193 1.107-2.249-.024-.01-2.112-.81-2.135-3.245ZM11.967 3.44c.543-.663.912-1.575.812-2.49-.785.033-1.757.53-2.322 1.18-.499.578-.942 1.517-.826 2.41.884.068 1.786-.448 2.336-1.1Z"/>
    </svg>
  );
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface SignInValues  { email: string; password: string; remember: boolean }
interface ForgotValues  { resetEmail: string }
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

  const [mode, setMode]           = useState<Mode>("signin");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState<"google" | "apple" | null>(null);

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

  /* ── OAuth ────────────────────────────────────────────────────────────── */
  async function oauthSignIn(provider: "google" | "apple") {
    setOauthBusy(provider); setError(null);
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ??
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${appUrl}/auth/callback` },
      });
      if (error) setError(error.message);
    } catch (e) { setError(e instanceof Error ? e.message : "OAuth sign-in failed"); }
    finally     { setOauthBusy(null); }
  }

  /* ── Forgot password ─────────────────────────────────────────────────── */
  const forgotForm = useForm<ForgotValues>();
  const sentEmail  = forgotForm.watch("resetEmail");

  async function onForgot(values: ForgotValues) {
    setError(null);
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ??
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error: e } = await createClient().auth.resetPasswordForEmail(
        values.resetEmail,
        { redirectTo: `${appUrl}/auth/callback?type=recovery` },
      );
      if (e) console.warn("[forgot-password]", e.message);
      setMode("sent");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send reset email"); }
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
          If <strong className="text-[var(--color-ink)]">{sentEmail}</strong> matches an account,
          a reset link is on its way.
        </p>
      </div>

      <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-canvas)] text-tiny text-[var(--color-ink-light)] leading-relaxed mb-5">
        <p className="font-semibold text-[var(--color-ink)] mb-1">Not seeing it?</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Check your spam or promotions folder</li>
          <li>Wait 60 seconds — the email service sometimes throttles</li>
          <li>Make sure you used the correct email address</li>
        </ul>
      </div>

      <button
        onClick={() => { setMode("forgot"); forgotForm.reset(); }}
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

      {/* OR divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">OR</span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      {/* OAuth */}
      <div className="grid grid-cols-2 gap-3">
        {(["google", "apple"] as const).map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => oauthSignIn(provider)}
            disabled={!!oauthBusy}
            className="flex items-center justify-center gap-2 h-11 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white text-small font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors disabled:opacity-60"
          >
            {oauthBusy === provider
              ? <span className="h-4 w-4 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-ink-light)] animate-spin" />
              : provider === "google" ? <GoogleIcon /> : <AppleIcon />
            }
            {provider === "google" ? "Sign in with Google" : "Sign in with Apple"}
          </button>
        ))}
      </div>

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
