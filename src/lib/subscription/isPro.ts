/**
 * Pure "is this profile Pro" logic, shared between the client hook
 * (useSubscription) and server-side code (cron routes) that has no React
 * context to read from - one implementation instead of two that can drift.
 */

/**
 * Owner override - these emails always get Pro access, regardless of
 * subscription status. Keep in sync with src/hooks/useSubscription.ts.
 */
export const ADMIN_EMAILS = ["ifeoluwaadegbulugbe@gmail.com"];

export interface ProfileSubscriptionFields {
  email?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
}

export interface SubscriptionState {
  isPro: boolean;
  isOnTrial: boolean;
  trialDaysLeft: number | null;
  trialUsed: boolean;
}

export function computeSubscriptionState(
  profile: ProfileSubscriptionFields | null | undefined,
  forcePro: boolean,
): SubscriptionState {
  if (forcePro) {
    return { isPro: true, isOnTrial: false, trialDaysLeft: null, trialUsed: false };
  }

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
}

/** Server-side convenience - just the boolean, for cron gating. */
export function isProServer(profile: ProfileSubscriptionFields | null | undefined): boolean {
  return computeSubscriptionState(profile, process.env.NEXT_PUBLIC_FORCE_PRO === "true").isPro;
}
