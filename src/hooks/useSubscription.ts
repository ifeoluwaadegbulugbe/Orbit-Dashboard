"use client";

import { useMemo, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { computeSubscriptionState, type SubscriptionState } from "@/lib/subscription/isPro";

/**
 * Development override - when NEXT_PUBLIC_FORCE_PRO is "true", every user is
 * treated as Pro. Useful for testing Pro features without going through
 * Paystack checkout. Switch back to "false" before deploying.
 */
const FORCE_PRO = process.env.NEXT_PUBLIC_FORCE_PRO === "true";

let warnedAboutForcePro = false;

/**
 * Trial-aware subscription state. isPro flips to false automatically when
 * trial_ends_at passes - no backend cron required for that transition.
 * Pure logic lives in src/lib/subscription/isPro.ts, shared with server-side
 * cron gating.
 */
export function useSubscription(): SubscriptionState {
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (FORCE_PRO && !warnedAboutForcePro && typeof window !== "undefined") {
      console.warn(
        "%c⚠️ FORCE_PRO is enabled%c - every user is treated as Pro for testing.\n" +
          "Set NEXT_PUBLIC_FORCE_PRO=false in .env.local before launching.",
        "background:#FAEDF1;color:#C41570;padding:2px 6px;border-radius:4px;font-weight:bold",
        "color:#9A9893",
      );
      warnedAboutForcePro = true;
    }
  }, []);

  return useMemo(
    () => computeSubscriptionState(profile, FORCE_PRO),
    [profile?.email, profile?.subscription_status, profile?.trial_ends_at],
  );
}
