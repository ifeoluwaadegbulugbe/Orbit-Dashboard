"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { User, Mail, Lock, Building2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "@/types";

/* ─── Shared input style ──────────────────────────────────────────────────────
   Matches login/page.tsx — height, radius, border, focus ring all use tokens. */
const inputCls =
  "w-full h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white " +
  "text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] " +
  "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 " +
  "transition-colors";

interface FormValues {
  fullName: string;
  businessName: string;
  businessType: BusinessType;
  email: string;
  password: string;
}

const BUSINESS_TYPES = Object.entries(BUSINESS_TYPE_LABELS) as [BusinessType, string][];

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, setValue, watch, formState } = useForm<FormValues>({
    defaultValues: { businessType: "nail_tech" },
  });
  const businessType = watch("businessType");

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      // Step 1: create the account on the server.
      // Server uses the Supabase Admin API to skip the verification email
      // (which has been flaky on the free tier). The /welcome page sends a
      // friendly welcome email via Resend instead — works on every region.
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          businessName: values.businessName || null,
          businessType: values.businessType,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(friendlyError(json.error ?? "Could not create account."));
        return;
      }

      // Step 2: sign in with the credentials we just used.
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInErr) {
        // Account created but sign-in failed — send to login with banner.
        router.replace("/login?signedUp=1");
        return;
      }

      // Step 3: through to the welcome wizard.
      router.replace("/welcome");
      router.refresh();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
    }
  }

  function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid path") || m.includes("not found"))
      return "Can't reach Supabase. Your NEXT_PUBLIC_SUPABASE_URL in .env.local looks wrong — copy it again from Supabase Dashboard → Settings → API → Project URL, then restart the dev server.";
    if (m.includes("fetch failed") || m.includes("network"))
      return "Network error — couldn't reach Supabase. Check your internet and that your Supabase URL is correct in .env.local.";
    if (m.includes("invalid api key"))
      return "Your Supabase anon key is wrong or doesn't match the project URL. Copy both from Settings → API.";
    if (m.includes("already registered") || m.includes("user already"))
      return "An account with this email already exists. Try signing in instead.";
    if (m.includes("error sending confirmation") || m.includes("error sending email") || m.includes("smtp"))
      return "We created your account but couldn't send the verification email. Wait 5 minutes and try signing in — if the account exists, use 'Forgot password' to set a new one.";
    if (m.includes("rate limit") || m.includes("too many"))
      return "Too many signup attempts. Wait a few minutes and try again.";
    if (m.includes("weak password") || m.includes("password should"))
      return "Pick a stronger password — at least 8 characters, mix of letters and numbers.";
    return msg;
  }

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8">

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-section font-bold text-[var(--color-ink)]">Create your account</h1>
        <p className="mt-2 text-small text-[var(--color-ink-light)]">
          Set up your Orbit account in under a minute.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-small">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Full name */}
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">
            Your name
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="e.g. Amaka Johnson"
              autoComplete="name"
              className={`${inputCls} pl-10`}
              {...register("fullName", { required: true })}
            />
          </div>
        </div>

        {/* Business name */}
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">
            Business name <span className="font-normal text-[var(--color-muted)]">(optional)</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="e.g. Glam by Amaka"
              className={`${inputCls} pl-10`}
              {...register("businessName")}
            />
          </div>
        </div>

        {/* Business type */}
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-2">
            What kind of work do you do?
          </label>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map(([type, label]) => {
              const active = businessType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue("businessType", type)}
                  className={`px-3.5 py-1.5 rounded-full text-tiny font-semibold border transition-colors ${
                    active
                      ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary-dark)]"
                      : "bg-white border-[var(--color-border)] text-[var(--color-ink-light)] hover:border-[var(--color-primary)]/40"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className={`${inputCls} pl-10`}
              {...register("email", { required: true })}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
            <input
              type={showPw ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className={`${inputCls} pl-10 pr-11`}
              {...register("password", { required: true, minLength: 8 })}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink-light)] transition-colors"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" size="lg" fullWidth loading={formState.isSubmitting}>
          Create account
        </Button>

        <p className="text-center text-tiny text-[var(--color-muted)] leading-relaxed pt-1">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="text-[var(--color-primary)] font-semibold hover:text-[var(--color-primary-dark)] transition-colors">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-[var(--color-primary)] font-semibold hover:text-[var(--color-primary-dark)] transition-colors">
            Privacy Policy
          </Link>.
        </p>

        <p className="text-center text-small text-[var(--color-ink-light)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
