/**
 * Who can use Orbit Pay, and on what terms.
 *
 * Orbit Pay is switched on by ORBIT_PAY_ENABLED=true (off until Paystack
 * approves split payments on Orbit's account), and is only for businesses
 * in Nigeria pricing in naira - money settles to a Nigerian bank account
 * through a Paystack subaccount.
 */

import "server-only";
import { computeSubscriptionState } from "@/lib/subscription/isPro";
import type { Plan } from "./fees";

export function orbitPayEnabled(): boolean {
  return process.env.ORBIT_PAY_ENABLED === "true";
}

/** Nigeria, or no country chosen yet (Orbit defaults to Nigeria and naira). */
export function orbitPayCountryOk(countryCode: string | null | undefined): boolean {
  return !countryCode || countryCode === "NG";
}

export function planFor(profile: { email?: string | null; subscription_status?: string | null; trial_ends_at?: string | null }): Plan {
  return computeSubscriptionState(profile, false).isPro ? "pro" : "free";
}

/**
 * Cards issued outside Nigeria. Off by default: keep "international
 * payments" off in Paystack too, and foreign cards are simply declined, so
 * Orbit can never be charged the higher foreign-card fee at the local price.
 * Turn both on to accept them; clients then must say how they're paying.
 */
export function internationalCardsEnabled(): boolean {
  return process.env.ORBIT_PAY_INTERNATIONAL === "true";
}

export const nairaToKobo = (naira: number) => Math.round(Number(naira) * 100);
