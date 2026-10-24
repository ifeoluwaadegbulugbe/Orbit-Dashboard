/**
 * Free-tier limits and Pro pricing. Single source of truth - UI and server-side
 * gates both read these. Keep in sync with the mobile app's `constants/limits.ts`.
 */

/** Also enforced in the database (supabase/migrations/022) - change both together. */
export const FREE_CLIENT_LIMIT = 10;
export const CLIENT_LIMIT_WARNING_THRESHOLD = FREE_CLIENT_LIMIT - 2; // 8

export const FREE_TRIAL_DAYS = 7;

// Pro prices live in src/lib/pricing.ts (naira for Nigeria, dollars elsewhere).

export const APP_NAME = "Orbit";
