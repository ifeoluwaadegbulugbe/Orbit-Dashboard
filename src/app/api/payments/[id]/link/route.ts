import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { payUrl } from "@/lib/signed-links";
import { track } from "@/lib/analytics/server";
import { orbitPayCountryOk, orbitPayEnabled, planFor, nairaToKobo } from "@/lib/orbit-pay/server";
import { quote, type FeeBearer } from "@/lib/orbit-pay/fees";

/**
 * POST /api/payments/:id/link - make an Orbit Pay link for an invoice.
 *
 * Money never touches Orbit: the client pays through Paystack and the
 * business's share settles straight to its own bank account (its Paystack
 * subaccount). This route only prices the charge - Orbit's fee is fixed
 * here, at the owner's plan right now - and returns the client's Orbit Pay
 * page, which shows the breakdown and then opens Paystack.
 *
 *   returns { payment_link }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!orbitPayEnabled()) {
    return NextResponse.json(
      { error: "Orbit Pay isn't switched on yet. You can still share your bank details and use Mark paid when the money arrives." },
      { status: 503 },
    );
  }

  // RLS: only the owner's own invoice comes back.
  const { data: payment } = await supabase
    .from("payments").select("id, user_id, amount, remaining_balance, status").eq("id", id).maybeSingle();
  if (!payment) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (payment.status === "paid") return NextResponse.json({ error: "This invoice is already marked as paid." }, { status: 409 });

  const service = createServiceClient();
  const [{ data: owner }, { data: account }] = await Promise.all([
    service.from("profiles").select("email, country_code, subscription_status, trial_ends_at").eq("id", user.id).maybeSingle(),
    service.from("orbit_pay_accounts").select("subaccount_code, fee_bearer").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!orbitPayCountryOk(owner?.country_code)) {
    return NextResponse.json({ error: "Orbit Pay is only available for businesses in Nigeria for now." }, { status: 400 });
  }
  if (!account?.subaccount_code) {
    return NextResponse.json({ error: "Add the bank account you want to be paid into first (Money → Orbit Pay).", code: "NO_PAYOUT_ACCOUNT" }, { status: 412 });
  }

  const due = Number(payment.remaining_balance) > 0 ? Number(payment.remaining_balance) : Number(payment.amount);
  const serviceKobo = nairaToKobo(due);
  if (!(serviceKobo >= 100_00)) return NextResponse.json({ error: "Orbit Pay needs an amount of at least ₦100." }, { status: 400 });

  const plan = planFor({ ...owner, email: owner?.email ?? user.email });
  const bearer = account.fee_bearer as FeeBearer;
  const local = quote(serviceKobo, plan, bearer, "local");
  const intl = quote(serviceKobo, plan, bearer, "international");

  const { data: charge, error } = await service.from("orbit_pay_charges").insert({
    user_id: user.id,
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
    return NextResponse.json({ error: "Couldn't create the payment link. Try again." }, { status: 500 });
  }

  const link = payUrl(charge.id as string);
  await service.from("payments").update({ payment_link: link, payment_provider: "paystack" }).eq("id", payment.id);
  await track(user.id, "payment_link_created", { dedupeKey: `payment_link_created:${charge.id}:${user.id}`, props: { plan, fee_bearer: bearer } });

  return NextResponse.json({ payment_link: link });
}
