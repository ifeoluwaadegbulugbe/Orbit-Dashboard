import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyId } from "@/lib/signed-links";
import { appUrl } from "@/lib/app-url";
import { initializeSplitCharge } from "@/lib/orbit-pay/paystack";
import { internationalCardsEnabled, orbitPayEnabled } from "@/lib/orbit-pay/server";

/**
 * POST /api/public/pay  { chargeId, t, international }
 *
 * The client tapped Pay on their Orbit Pay page. Opens a Paystack checkout
 * for the amounts fixed when the link was made (local or international
 * card rate), split so the business's share settles to its own bank.
 * Signed link only - the id alone isn't enough.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { chargeId?: unknown; t?: unknown; international?: unknown } | null;
  const chargeId = typeof body?.chargeId === "string" ? body.chargeId : "";
  if (!chargeId || !verifyId("pay", chargeId, typeof body?.t === "string" ? body.t : null)) {
    return NextResponse.json({ error: "This payment link isn't valid." }, { status: 404 });
  }
  if (!orbitPayEnabled()) return NextResponse.json({ error: "Online payment isn't available right now." }, { status: 503 });

  const supabase = createServiceClient();
  const { data: charge } = await supabase.from("orbit_pay_charges").select("*").eq("id", chargeId).maybeSingle();
  if (!charge) return NextResponse.json({ error: "This payment link isn't valid." }, { status: 404 });
  if (["success", "refunded", "partially_refunded", "disputed"].includes(charge.status)) {
    return NextResponse.json({ error: "This has already been paid." }, { status: 409 });
  }

  const { data: payment } = await supabase
    .from("payments").select("id, status, client_id, payment_link, invoice_number").eq("id", charge.payment_id).maybeSingle();
  if (!payment || payment.status === "paid") return NextResponse.json({ error: "This invoice has already been paid." }, { status: 409 });
  // A newer link replaces older ones, so an old link can't be paid at an old price.
  if (!String(payment.payment_link ?? "").includes(`/pay/${chargeId}`)) {
    return NextResponse.json({ error: "This link has been replaced. Ask the business for their latest payment link." }, { status: 410 });
  }

  const { data: client } = await supabase.from("clients").select("email, phone").eq("id", payment.client_id).maybeSingle();
  const email = client?.email?.trim() || `client-${String(payment.client_id).slice(0, 8)}@pay.getorbitcrm.com`;

  // With foreign cards on, the client must have answered the card question.
  if (internationalCardsEnabled() && typeof body?.international !== "boolean") {
    return NextResponse.json({ error: "Choose how you're paying first." }, { status: 400 });
  }
  const international = internationalCardsEnabled() && body?.international === true;
  const chargeKobo = Number(international ? charge.intl_charge_kobo : charge.charge_kobo);
  const feeKobo = Number(international ? charge.intl_fee_kobo : charge.fee_kobo);
  // Unique per attempt - Paystack rejects a reused reference.
  const reference = `orbitpay_${chargeId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;
  const t = body!.t as string;

  try {
    const init = await initializeSplitCharge({
      email,
      chargeKobo,
      feeKobo,
      subaccountCode: charge.subaccount_code,
      reference,
      callbackUrl: `${appUrl()}/pay/${chargeId}?t=${encodeURIComponent(t)}&done=1`,
      metadata: { kind: "orbit_pay", charge_id: chargeId, payment_id: payment.id, user_id: charge.user_id, card_region: international ? "international" : "local" },
    });
    await supabase.from("orbit_pay_charges")
      .update({ reference, status: "pending", card_region: international ? "international" : "local", updated_at: new Date().toISOString() })
      .eq("id", chargeId);
    return NextResponse.json({ url: init.authorization_url });
  } catch (err) {
    console.error("[orbit-pay] initialize failed:", err);
    return NextResponse.json({ error: "Couldn't open the payment page. Please try again in a minute." }, { status: 502 });
  }
}
