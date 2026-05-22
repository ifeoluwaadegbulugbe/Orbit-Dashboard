"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { User, Mail, Lock, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "@/types";

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
      // friendly welcome email via Resend instead - works on every region.
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
        setError(friendlySupabaseError(json.error ?? "Could not create account."));
        return;
      }

      // Step 2: sign in with the credentials we just used. Now the user has a
      // real session cookie and can hit RLS-protected routes.
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInErr) {
        // Account was created but sign-in failed - send them to login with
        // a helpful banner. Should be vanishingly rare.
        router.replace("/login?signedUp=1");
        return;
      }

      // Step 3: through to the wizard. /welcome upserts the profile + fires
      // the welcome email idempotently.
      router.replace("/welcome");
      router.refresh();
    } catch (err) {
      setError(friendlySupabaseError(err instanceof Error ? err.message : String(err)));
    }
  }

  function friendlySupabaseError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid path") || m.includes("not found")) {
      return "Can't reach Supabase. Your NEXT_PUBLIC_SUPABASE_URL in .env.local looks wrong - copy it again from Supabase Dashboard → Settings → API → Project URL, then restart the dev server.";
    }
    if (m.includes("fetch failed") || m.includes("network")) {
      return "Network error - couldn't reach Supabase. Check your internet and that your Supabase URL is correct in .env.local.";
    }
    if (m.includes("invalid api key")) {
      return "Your Supabase anon key is wrong or doesn't match the project URL. Copy both from Settings → API.";
    }
    if (m.includes("already registered") || m.includes("user already")) {
      return "An account with this email already exists. Try signing in instead.";
    }
    // Supabase's exact error string when its SMTP fails (custom or default).
    // Distinct copy + actionable fix so users aren't stuck staring at a
    // raw "Error sending confirmation email" line.
    if (m.includes("error sending confirmation") || m.includes("error sending email") || m.includes("smtp")) {
      return "We created your account but couldn't send the verification email. This usually means Supabase's email service is rate-limited (3-4/hour on the free tier) or its custom SMTP is misconfigured. Wait 5 minutes and try signing in - if the account exists, use 'Forgot password' to set one. Otherwise contact support.";
    }
    if (m.includes("rate limit") || m.includes("too many")) {
      return "Too many signup attempts. Wait a few minutes and try again.";
    }
    if (m.includes("weak password") || m.includes("password should")) {
      return "Pick a stronger password - at least 8 characters, mix of letters and numbers.";
    }
    return msg;
  }

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-section font-bold text-[var(--color-ink)]">Create your account</h1>
        <p className="mt-3 text-lead text-[var(--color-ink-light)]">Set up your Orbit account in under a minute.</p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white p-8 rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm">
        <Input label="Your name" icon={<User className="h-4 w-4" />} placeholder="e.g. Amaka Johnson" autoComplete="name" {...register("fullName", { required: true })} />
        <Input label="Business name" icon={<Building2 className="h-4 w-4" />} placeholder="e.g. Glam by Amaka (optional)" {...register("businessName")} />

        <div>
          <label className="block text-sm font-semibold mb-1.5">What kind of work do you do?</label>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map(([type, label]) => {
              const active = businessType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue("businessType", type)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
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

        <Input label="Email" type="email" icon={<Mail className="h-4 w-4" />} placeholder="you@example.com" autoComplete="email" {...register("email", { required: true })} />
        <Input label="Password" type="password" icon={<Lock className="h-4 w-4" />} placeholder="At least 8 characters" autoComplete="new-password" {...register("password", { required: true, minLength: 8 })} />

        <Button type="submit" size="lg" fullWidth loading={formState.isSubmitting}>
          Create account
        </Button>

        <p className="text-center text-xs text-[var(--color-muted)] leading-relaxed pt-1">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="text-[var(--color-primary)] font-semibold">Terms</Link> and{" "}
          <Link href="/privacy" className="text-[var(--color-primary)] font-semibold">Privacy Policy</Link>.
        </p>

        <p className="text-center text-sm text-[var(--color-ink-light)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
