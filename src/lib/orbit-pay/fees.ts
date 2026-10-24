/**
 * Orbit Pay fees. Pure functions, all money in kobo (integers).
 *
 * Orbit's fee is worked out on the service price (P) at the moment a
 * payment link is created, using the business's plan at that moment, and
 * stored with the charge - a later plan change never alters it.
 *
 *   fee = min(rate x P + fixed, cap), rounded UP to the next whole naira
 *
 * Who pays it ("fee bearer"):
 *   merchant: client pays P,        business receives P - fee
 *   client:   client pays P + fee,  business receives P
 *
 * Paystack's own processing fee always comes out of Orbit's share
 * (transaction `bearer: "account"`), so Orbit's net is fee - Paystack fee.
 * All numbers below are config: change them here, not in the code paths.
 */

export type Plan = "free" | "pro";
export type FeeBearer = "merchant" | "client";
export type CardRegion = "local" | "international";

interface FeeRule {
  /** e.g. 0.025 = 2.5% */
  rate: number;
  fixedKobo: number;
  /** null = no cap */
  capKobo: number | null;
}

export const ORBIT_PAY_FEES: Record<CardRegion, Record<Plan, FeeRule>> = {
  local: {
    free: { rate: 0.025, fixedKobo: 100_00, capKobo: 3_500_00 },
    pro: { rate: 0.02, fixedKobo: 100_00, capKobo: 2_500_00 },
  },
  // Cards issued outside Nigeria cost Orbit 3.9% + ₦100 at Paystack, with
  // no cap - so this fee is uncapped too, or big payments would lose money.
  international: {
    free: { rate: 0.05, fixedKobo: 150_00, capKobo: null },
    pro: { rate: 0.045, fixedKobo: 150_00, capKobo: null },
  },
};

/**
 * Paystack Nigeria pricing that Orbit pays (verify against
 * paystack.com/pricing before launch and whenever Paystack changes it).
 */
export const PAYSTACK_FEES: Record<CardRegion, { rate: number; fixedKobo: number; fixedWaivedUpToKobo: number; capKobo: number | null }> = {
  local: { rate: 0.015, fixedKobo: 100_00, fixedWaivedUpToKobo: 2_500_00, capKobo: 2_000_00 },
  international: { rate: 0.039, fixedKobo: 100_00, fixedWaivedUpToKobo: 0, capKobo: null },
};

const ceilToNaira = (kobo: number) => Math.ceil(kobo / 100) * 100;

/** Orbit's fee on service price P (kobo), in kobo, rounded up to the naira. */
export function orbitFeeKobo(serviceKobo: number, plan: Plan, region: CardRegion = "local"): number {
  if (!Number.isInteger(serviceKobo) || serviceKobo <= 0) throw new Error("Service price must be a positive whole number of kobo");
  const r = ORBIT_PAY_FEES[region][plan];
  const raw = ceilToNaira(serviceKobo * r.rate + r.fixedKobo);
  return r.capKobo === null ? raw : Math.min(raw, r.capKobo);
}

export interface FeeQuote {
  plan: Plan;
  region: CardRegion;
  bearer: FeeBearer;
  serviceKobo: number;
  /** Orbit's fee (goes to Orbit's main account via transaction_charge). */
  feeKobo: number;
  /** What the client is charged at Paystack. */
  chargeKobo: number;
  /** What settles to the business's bank (before any refund). */
  merchantKobo: number;
}

export function quote(serviceKobo: number, plan: Plan, bearer: FeeBearer, region: CardRegion = "local"): FeeQuote {
  const feeKobo = orbitFeeKobo(serviceKobo, plan, region);
  const chargeKobo = bearer === "client" ? serviceKobo + feeKobo : serviceKobo;
  return { plan, region, bearer, serviceKobo, feeKobo, chargeKobo, merchantKobo: chargeKobo - feeKobo };
}

/** Estimate of what Paystack charges Orbit on a payment of `chargeKobo`. */
export function paystackFeeKobo(chargeKobo: number, region: CardRegion = "local"): number {
  const p = PAYSTACK_FEES[region];
  const fixed = chargeKobo <= p.fixedWaivedUpToKobo ? 0 : p.fixedKobo;
  const fee = Math.ceil(chargeKobo * p.rate + fixed);
  return p.capKobo === null ? fee : Math.min(fee, p.capKobo);
}

/** Orbit's take after Paystack's fee (estimate). */
export function orbitNetKobo(q: FeeQuote): number {
  return q.feeKobo - paystackFeeKobo(q.chargeKobo, q.region);
}
