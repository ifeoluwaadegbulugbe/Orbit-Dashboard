/**
 * Free-tier limits and Pro pricing. Single source of truth - UI and server-side
 * gates both read these. Keep in sync with the mobile app's `constants/limits.ts`.
 */

export const FREE_CLIENT_LIMIT = 10;
export const CLIENT_LIMIT_WARNING_THRESHOLD = FREE_CLIENT_LIMIT - 2; // 8

export const FREE_TRIAL_DAYS = 7;

/** Display price. Actual billing happens via Paystack plan. */
export const PRO_PRICE_DISPLAY = "$12";
export const PRO_PRICE_PERIOD = "/month";

/** Paystack plan code (env var). Plan is created in Paystack dashboard. */
export const PAYSTACK_PLAN_CODE = process.env.NEXT_PUBLIC_PAYSTACK_PLAN_CODE ?? "";

export const APP_NAME = "Orbit";
