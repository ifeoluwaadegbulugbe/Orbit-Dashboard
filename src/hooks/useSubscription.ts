"use client";

import { useMemo, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

interface SubscriptionState {
  /** True if the user has Pro access (paid OR active trial). */
  isPro: boolean;
  /** True only when actively in a trial period. */
  isOnTrial: boolean;
  /** Whole days remaining on the trial, or null. */
  trialDaysLeft: number | null;
  /** True if a trial was used in the past and has expired. */
  trialUsed: boolean;
}

/**
 * Development override - when NEXT_PUBLIC_FORCE_PRO is "true", every user is
 * treated as Pro. Useful for testing Pro features without going through
 * Paystack checkout. Switch back to "false" before deploying.
 */
const FORCE_PRO = process.env.NEXT_PUBLIC_FORCE_PRO === "true";

/**
 * Owner override - these emails always get Pro access, regardless of
 * subscription status. Useful so the founder's own account never hits
 * the paywall. Add your Gmail (or whichever email you sign in with) here.
 */
const ADMIN_EMAILS = ["ifeoluwaadegbulugbe@gmail.com"];

let warnedAboutForcePro = false;

/**
 * Trial-aware subscription state. isPro flips to false automatically when
 * trial_ends_at passes - no backend cron required for that transition.
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

  return useMemo(() => {
    // Dev override: skip the paywall entirely
    if (FORCE_PRO) {
      return { isPro: true, isOnTrial: false, trialDaysLeft: null, trialUsed: false };
    }

    // Owner override: this account always gets Pro, no paywall.
    if (profile?.email && ADMIN_EMAILS.includes(profile.email)) {
      return { isPro: true, isOnTrial: false, trialDaysLeft: null, trialUsed: false };
    }

    const status = profile?.subscription_status;
    const trialEndsAt = profile?.trial_ends_at;

    if (status === "pro") {
      return { isPro: true, isOnTrial: false, trialDaysLeft: null, trialUsed: false };
    }

    if (status === "trial" && trialEndsAt) {
      const msLeft = new Date(trialEndsAt).getTime() - Date.now();
      if (msLeft > 0) {
        return {
          isPro: true,
          isOnTrial: true,
          trialDaysLeft: Math.ceil(msLeft / (1000 * 60 * 60 * 24)),
          trialUsed: false,
        };
      }
    }

    const trialUsed = !!trialEndsAt && new Date(trialEndsAt).getTime() < Date.now();
    return { isPro: false, isOnTrial: false, trialDaysLeft: null, trialUsed };
  }, [profile?.email, profile?.subscription_status, profile?.trial_ends_at]);
}
