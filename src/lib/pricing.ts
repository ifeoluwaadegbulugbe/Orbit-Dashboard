/**
 * Orbit Pro prices, shown in each African business's own currency.
 *
 * Billing: Orbit's Paystack account is Nigerian, so every subscription is
 * charged in naira (the NGN plans). Businesses outside Nigeria see their
 * local price, and at checkout are told it's charged as the naira amount,
 * which their bank converts. When Orbit opens Paystack accounts in Ghana,
 * Kenya or South Africa, those countries can bill natively.
 *
 * Countries not listed see the naira price.
 */

export type BillingInterval = "monthly" | "yearly";

interface LocalPrice {
  currency: string; // ISO 4217
  monthly: number;
  yearly: number;
  format: (n: number) => string;
}

const fmt = (prefix: string, suffix = "") => (n: number) => `${prefix}${n.toLocaleString("en-US")}${suffix}`;
const cfa = (n: number) => `${n.toLocaleString("en-US")} CFA`;

/** What Paystack actually charges, everywhere. */
export const NGN_PRICE: LocalPrice = { currency: "NGN", monthly: 7_500, yearly: 75_000, format: fmt("₦") };

const CFA_WEST = ["BJ", "BF", "CI", "GW", "ML", "NE", "SN", "TG"];   // XOF
const CFA_CENTRAL = ["CM", "CF", "TD", "CG", "GQ", "GA"];          // XAF

const BY_COUNTRY: Record<string, LocalPrice> = {
  NG: NGN_PRICE,
  GH: { currency: "GHS", monthly: 75, yearly: 750, format: fmt("GH₵") },
  KE: { currency: "KES", monthly: 700, yearly: 7_000, format: fmt("KSh ") },
  ZA: { currency: "ZAR", monthly: 99, yearly: 990, format: fmt("R") },
  UG: { currency: "UGX", monthly: 20_000, yearly: 200_000, format: fmt("USh ") },
  TZ: { currency: "TZS", monthly: 14_000, yearly: 140_000, format: fmt("TSh ") },
  EG: { currency: "EGP", monthly: 250, yearly: 2_500, format: fmt("E£") },
  RW: { currency: "RWF", monthly: 7_000, yearly: 70_000, format: fmt("RF ") },
  MA: { currency: "MAD", monthly: 55, yearly: 550, format: fmt("", " MAD") },
  ...Object.fromEntries(CFA_WEST.map((c) => [c, { currency: "XOF", monthly: 3_000, yearly: 30_000, format: cfa }])),
  ...Object.fromEntries(CFA_CENTRAL.map((c) => [c, { currency: "XAF", monthly: 3_000, yearly: 30_000, format: cfa }])),
};

export function localPriceFor(countryCode: string | null | undefined): LocalPrice {
  return (countryCode && BY_COUNTRY[countryCode]) || NGN_PRICE;
}

/** Charged in naira while the business sees another currency. */
export function billedInNaira(countryCode: string | null | undefined): boolean {
  return localPriceFor(countryCode).currency !== "NGN";
}

/** "GH₵75/month", "₦75,000/year" */
export function priceLabel(countryCode: string | null | undefined, interval: BillingInterval): string {
  const p = localPriceFor(countryCode);
  return `${p.format(p[interval])}/${interval === "monthly" ? "month" : "year"}`;
}

/** What 12 months would cost minus the yearly price, in local money. */
export function yearlySaving(countryCode: string | null | undefined): string {
  const p = localPriceFor(countryCode);
  return p.format(p.monthly * 12 - p.yearly);
}

/** Paystack plan code env var - always naira (see top of file). */
export function planEnvVar(interval: BillingInterval): string {
  return `PAYSTACK_PLAN_NGN_${interval.toUpperCase()}`;
}

/** The Paystack plan codes that are Orbit Pro (only these may grant Pro). */
export function proPlanCodes(): string[] {
  return [process.env.PAYSTACK_PLAN_NGN_MONTHLY, process.env.PAYSTACK_PLAN_NGN_YEARLY].filter((c): c is string => !!c);
}

/** Paystack sends a transaction's plan as a code or as an object. */
export function planCodeOf(plan: unknown): string | null {
  if (typeof plan === "string") return plan || null;
  if (plan && typeof plan === "object" && "plan_code" in plan) return String((plan as { plan_code: unknown }).plan_code ?? "") || null;
  return null;
}
