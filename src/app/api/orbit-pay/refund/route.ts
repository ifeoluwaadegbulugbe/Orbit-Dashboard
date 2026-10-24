import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refundTransaction } from "@/lib/orbit-pay/paystack";

/**
 * POST /api/orbit-pay/refund { paymentId, amountKobo? } - refund a client
 * through Paystack. The money comes back out of the business's own Paystack
 * settlements (Orbit never holds it). The charge is marked refunded when
 * Paystack's refund.processed webhook arrives.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { paymentId?: unknown; amountKobo?: unknown } | null;
  const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
  const service = createServiceClient();
  const { data: charge } = await service
    .from("orbit_pay_charges").select("id, user_id, reference, status, paid_kobo, refunded_kobo")
    .eq("payment_id", paymentId).eq("user_id", user.id).in("status", ["success", "partially_refunded"])
    .order("paid_at", { ascending: false }).limit(1).maybeSingle();
  if (!charge?.reference) return NextResponse.json({ error: "There's no Orbit Pay payment on this invoice to refund." }, { status: 404 });

  const left = Number(charge.paid_kobo ?? 0) - Number(charge.refunded_kobo ?? 0);
  const amount = body?.amountKobo === undefined ? undefined : Number(body.amountKobo);
  if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0 || amount > left)) {
    return NextResponse.json({ error: "Enter an amount up to what's left to refund." }, { status: 400 });
  }
  try {
    await refundTransaction(charge.reference, amount);
    return NextResponse.json({ ok: true, message: "Refund started. Paystack takes it from your next settlement." });
  } catch (err) {
    console.error("[orbit-pay/refund]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Paystack couldn't start the refund." }, { status: 502 });
  }
}
