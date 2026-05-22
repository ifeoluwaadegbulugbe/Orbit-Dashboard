"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Mail, Lock, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface FormValues {
  email: string;
  password: string;
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
  const signedUp = search.get("signedUp") === "1";
  const verifyError = search.get("verifyError");           // surfaced from /auth/callback
  const reset = search.get("reset") === "1";               // post-password-reset confirmation
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<FormValues>();

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setError(friendlySupabaseError(error.message));
        return;
      }
      router.replace("/home");
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
    if (m.includes("invalid login credentials")) {
      return "Email or password doesn't match any account. Sign up if you haven't yet.";
    }
    return msg;
  }

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
            ? "That verification link has expired. Sign in if you've already verified, or request a fresh email from the verify-email screen."
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white p-8 rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm">
        <Input
          label="Email"
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          autoComplete="email"
          {...register("email", { required: true })}
        />
        <Input
          label="Password"
          type="password"
          icon={<Lock className="h-4 w-4" />}
          placeholder="Your password"
          autoComplete="current-password"
          {...register("password", { required: true })}
        />

        <div className="flex justify-end -mt-2">
          <Link
            href="/forgot-password"
            className="text-tiny font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={formState.isSubmitting}>
          Sign in
        </Button>

        <p className="text-center text-sm text-[var(--color-ink-light)] pt-1">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
            Sign up free
          </Link>
        </p>
      </form>
    </div>
  );
}
