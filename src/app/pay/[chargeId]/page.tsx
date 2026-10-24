import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyId } from "@/lib/signed-links";
import { PublicShell, PublicMessage } from "@/components/public/PublicShell";
import { PayForm } from "@/components/public/PayForm";
import { internationalCardsEnabled } from "@/lib/orbit-pay/server";

export const metadata: Metadata = { title: "Pay your invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * /pay/<chargeId>?t=<signature> - the client's Orbit Pay page. Shows what
 * they're paying (with the processing fee on its own line when the
 * business passes it on), then opens Paystack. After paying, Paystack
 * sends them back here with ?done=1.
 */
export default async function PayPage({
  params, searchParams,
}: {
  params: Promise<{ chargeId: string }>;
  searchParams: Promise<{ t?: string; done?: string }>;
}) {
  const { chargeId } = await params;
  const { t, done } = await searchParams;
  if (!verifyId("pay", chargeId, t)) {
    return <PublicShell><PublicMessage title="This link isn't valid" body="Ask the business to send you the payment link again." /></PublicShell>;
  }

  const supabase = createServiceClient();
  const { data: charge } = await supabase
    .from("orbit_pay_charges")
    .select("id, user_id, payment_id, status, fee_bearer, service_kobo, fee_kobo, charge_kobo, intl_fee_kobo, intl_charge_kobo")
    .eq("id", chargeId).maybeSingle();
  if (!charge) return <PublicShell><PublicMessage title="Not found" body="This payment link is no longer available." /></PublicShell>;

  const [{ data: payment }, { data: owner }] = await Promise.all([
    supabase.from("payments").select("invoice_number, status, payment_link").eq("id", charge.payment_id).maybeSingle(),
    supabase.from("profiles").select("business_name, full_name").eq("id", charge.user_id).maybeSingle(),
  ]);
  const business = owner?.business_name || owner?.full_name || "the business";

  if (charge.status === "success" || charge.status === "refunded" || charge.status === "partially_refunded" || payment?.status === "paid") {
    return <PublicShell><PublicMessage title="Paid - thank you" body={`${business} has received your payment. You can close this page.`} /></PublicShell>;
  }
  if (done) {
    return <PublicShell><PublicMessage title="Thanks - confirming your payment" body={`Paystack is confirming your payment. ${business} will see it in a moment. If you were charged, there's nothing else to do.`} /></PublicShell>;
  }
  if (!payment || !String(payment.payment_link ?? "").includes(`/pay/${chargeId}`)) {
    return <PublicShell><PublicMessage title="This link has been replaced" body={`Ask ${business} for their latest payment link.`} /></PublicShell>;
  }

  return (
    <PublicShell>
      <PayForm
        chargeId={chargeId}
        token={t!}
        business={business}
        invoiceNumber={payment.invoice_number ?? null}
        clientPaysFee={charge.fee_bearer === "client"}
        askCardOrigin={internationalCardsEnabled()}
        local={{ service: Number(charge.service_kobo), fee: Number(charge.fee_kobo), total: Number(charge.charge_kobo) }}
        international={{ service: Number(charge.service_kobo), fee: Number(charge.intl_fee_kobo), total: Number(charge.intl_charge_kobo) }}
      />
    </PublicShell>
  );
}
