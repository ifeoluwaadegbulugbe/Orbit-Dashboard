"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface SignInValues {
  email: string;
  password: string;
  remember: boolean;
}
interface ForgotValues {
  resetEmail: string;
}

type Mode = "signin" | "forgot" | "sent";

// ── Inline Google SVG icon ────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

// ── Inline Apple SVG icon ─────────────────────────────────────────────────────
function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
      <path d="M14.045 9.77c-.021-2.03 1.657-3.013 1.732-3.06-0.944-1.38-2.41-1.57-2.934-1.59-1.249-.127-2.44.737-3.072.737-.632 0-1.604-.72-2.637-.7-1.356.02-2.61.79-3.307 2.007-1.413 2.447-.362 6.075.999 8.063.668.963 1.462 2.042 2.503 2.003 1.006-.04 1.385-.648 2.601-.648 1.216 0 1.556.648 2.618.626 1.083-.018 1.766-.977 2.425-1.944.773-1.113 1.09-2.193 1.107-2.249-.024-.01-2.112-.81-2.135-3.245ZM11.967 3.44c.543-.663.912-1.575.812-2.49-.785.033-1.757.53-2.322 1.18-.499.578-.942 1.517-.826 2.41.884.068 1.786-.448 2.336-1.1Z"/>
    </svg>
  );
}

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
  const signedUp   = search.get("signedUp") === "1";
  const verifyError = search.get("verifyError");
  const reset      = search.get("reset") === "1";

  const [mode, setMode]             = useState<Mode>("signin");
  const [showPassword, setShowPw]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [oauthLoading, setOAuthLoading] = useState<"google" | "apple" | null>(null);

  // ── Sign-in form ─────────────────────────────────────────────────────────
  const signInForm = useForm<SignInValues>({ defaultValues: { remember: false } });

  async function onSignIn(values: SignInValues) {
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) { setError(friendlyError(error.message)); return; }
      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
    }
  }

  // ── OAuth helpers ─────────────────────────────────────────────────────────
  async function signInWithOAuth(provider: "google" | "apple") {
    setOAuthLoading(provider);
    setError(null);
    try {
      const supabase = createClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${appUrl}/auth/callback` },
      });
      if (error) setError(error.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth sign-in failed");
    } finally {
      setOAuthLoading(null);
    }
  }

  // ── Forgot-password form ─────────────────────────────────────────────────
  const forgotForm = useForm<ForgotValues>();
  const sentEmail  = forgotForm.watch("resetEmail");

  async function onForgot(values: ForgotValues) {
    setError(null);
    try {
      const supabase = createClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        values.resetEmail,
        { redirectTo: `${appUrl}/auth/callback?type=recovery` },
      );
      if (err) console.warn("[forgot-password]", err.message);
      setMode("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    }
  }

  function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid path") || m.includes("not found"))
      return "Can't reach authentication service. Check NEXT_PUBLIC_SUPABASE_URL in your environment settings.";
    if (m.includes("fetch failed") || m.includes("network"))
      return "Network error — check your internet connection and try again.";
    if (m.includes("invalid api key"))
      return "Authentication service misconfigured. Contact support.";
    if (m.includes("invalid login credentials"))
      return "Email or password is incorrect. Try again or reset your password.";
    return msg;
  }

  // ── Shared banners ────────────────────────────────────────────────────────
  const banners = (
    <>
      {signedUp && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Account created! Sign in to continue.
        </div>
      )}
      {reset && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Password updated. Sign in with your new password.
        </div>
      )}
      {verifyError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 text-amber-700 text-sm">
          {verifyError === "link_expired"
            ? "That link has expired. Try signing in or request a new reset email."
            : verifyError === "missing_code"
              ? "That link looks incomplete — try clicking it again from your email."
              : "We couldn't verify that link. Request a new one or contact support."}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}
    </>
  );

  // ── Check-your-inbox state ────────────────────────────────────────────────
  if (mode === "sent") {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Check your inbox</h1>
          <p className="mt-2 text-sm text-gray-500">
            If <strong className="text-gray-700">{sentEmail}</strong> matches an account,
            a password reset link is on its way.
          </p>
        </div>

        <div className="px-4 py-3 rounded-xl bg-gray-50 text-xs text-gray-500 leading-relaxed mb-4">
          <p className="font-semibold text-gray-700 mb-1">Not seeing it?</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Check your spam or promotions folder</li>
            <li>Wait 60 seconds — the email service sometimes throttles</li>
            <li>Make sure you used the correct email address</li>
          </ul>
        </div>

        <button
          onClick={() => { setMode("forgot"); forgotForm.reset(); }}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Try a different email
        </button>

        <button
          onClick={() => { setMode("signin"); setError(null); }}
          className="w-full mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700 py-2 flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </button>
      </div>
    );
  }

  // ── Forgot-password form ──────────────────────────────────────────────────
  if (mode === "forgot") {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Enter your email and we&apos;ll send you a link to reset it.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                autoFocus
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors"
                {...forgotForm.register("resetEmail", { required: true })}
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={forgotForm.formState.isSubmitting}
            className="h-12 rounded-xl text-sm font-semibold"
          >
            Send reset link
          </Button>
        </form>

        <button
          type="button"
          onClick={() => { setMode("signin"); setError(null); }}
          className="w-full mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 py-2 flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </button>
      </div>
    );
  }

  // ── Main sign-in form ─────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
        <p className="mt-1.5 text-sm text-gray-500">Welcome back! Please enter your details.</p>
      </div>

      {banners}

      <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors"
              {...signInForm.register("email", { required: true })}
            />
          </div>
        </div>

        {/* Password with show/hide toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full h-12 pl-10 pr-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-colors"
              {...signInForm.register("password", { required: true })}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />
              }
            </button>
          </div>
        </div>

        {/* Remember + Forgot row */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
              {...signInForm.register("remember")}
            />
            <span className="text-sm text-gray-600">Remember for 30 Days</span>
          </label>
          <button
            type="button"
            onClick={() => { setMode("forgot"); setError(null); }}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Forgot password
          </button>
        </div>

        {/* Sign in button */}
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={signInForm.formState.isSubmitting}
          className="h-12 rounded-xl text-sm font-semibold"
        >
          Sign in
        </Button>
      </form>

      {/* OR divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">OR</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* OAuth buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => signInWithOAuth("google")}
          disabled={!!oauthLoading}
          className="flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {oauthLoading === "google"
            ? <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
            : <GoogleIcon />
          }
          Sign up with Google
        </button>
        <button
          type="button"
          onClick={() => signInWithOAuth("apple")}
          disabled={!!oauthLoading}
          className="flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {oauthLoading === "apple"
            ? <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
            : <AppleIcon />
          }
          Sign up with Apple
        </button>
      </div>

      {/* Sign up link */}
      <p className="text-center text-sm text-gray-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-bold text-gray-900 hover:text-blue-600 transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  );
}
