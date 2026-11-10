/**
 * Makes an Orbit Pay link for one invoice (payments row). Shared by the
 * "Generate payment link" button and by booking deposits, so both price
 * the charge the same way: the client pays Orbit's fee as a separate line
 * and the business receives the full amount in its own bank account.
 */

import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";
import { payUrl } from "@/lib/signed-links";
import { orbitPayCountryOk, orbitPayEnabled, planFor, nairaToKobo } from "./server";
import { quote, type FeeBearer } from "./fees";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type PayLinkResult =
  | { ok: true; link: string; chargeId: string; plan: "free" | "pro" }
  | { ok: false; error: string; code?: string; status: number };

export async function createOrbitPayLink(
  service: ServiceClient,
  owner: { id: string; email?: string | null },
  payment: { id: string; amount: number | string; remaining_balance?: number | string | null },
): Promise<PayLinkResult> {
  if (!orbitPayEnabled()) {
    return { ok: false, status: 503, code: "ORBIT_PAY_OFF", error: "Orbit Pay isn't switched on yet. You can still share your bank details and use Mark paid when the money arrives." };
  }
  const [{ data: profile }, { data: account }] = await Promise.all([
    service.from("profiles").select("email, country_code, subscription_status, trial_ends_at").eq("id", owner.id).maybeSingle(),
    service.from("orbit_pay_accounts").select("subaccount_code").eq("user_id", owner.id).maybeSingle(),
  ]);
  if (!orbitPayCountryOk(profile?.country_code)) {
    return { ok: false, status: 400, code: "COUNTRY", error: "Orbit Pay is only available for businesses in Nigeria for now." };
  }
  if (!account?.subaccount_code) {
    return { ok: false, status: 412, code: "NO_PAYOUT_ACCOUNT", error: "Add the bank account you want to be paid into first (Money → Orbit Pay)." };
  }

  const due = Number(payment.remaining_balance) > 0 ? Number(payment.remaining_balance) : Number(payment.amount);
  const serviceKobo = nairaToKobo(due);
  if (!(serviceKobo >= 100_00)) return { ok: false, status: 400, code: "TOO_SMALL", error: "Orbit Pay needs an amount of at least ₦100." };

  const plan = planFor({ ...profile, email: profile?.email ?? owner.email });
  // The client always pays Orbit's fee, as a separate "Processing fee"
  // line, so the business receives the full invoice amount.
  const bearer: FeeBearer = "client";
  const local = quote(serviceKobo, plan, bearer, "local");
  const intl = quote(serviceKobo, plan, bearer, "international");

  const { data: charge, error } = await service.from("orbit_pay_charges").insert({
    user_id: owner.id,
    payment_id: payment.id,
    subaccount_code: account.subaccount_code,
    plan_at_charge: plan,
    fee_bearer: bearer,
    service_kobo: serviceKobo,
    fee_kobo: local.feeKobo,
    charge_kobo: local.chargeKobo,
    intl_fee_kobo: intl.feeKobo,
    intl_charge_kobo: intl.chargeKobo,
  }).select("id").single();
  if (error || !charge) {
    console.error("[orbit-pay] could not create charge:", error);
    return { ok: false, status: 500, error: "Couldn't create the payment link. Try again." };
  }

  const link = payUrl(charge.id as string);
  await service.from("payments").update({ payment_link: link, payment_provider: "paystack" }).eq("id", payment.id);
  return { ok: true, link, chargeId: charge.id as string, plan };
}
