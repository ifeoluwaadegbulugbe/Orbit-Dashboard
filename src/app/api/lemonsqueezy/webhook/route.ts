import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyLemonSqueezySignature } from "@/lib/lemonsqueezy/server";
import { notify } from "@/lib/notifications/server";

/**
 * Lemon Squeezy webhook -> marks Orbit invoices as paid when the customer
 * completes a checkout.
 *
 * Configure in each business owner's Lemon Squeezy dashboard:
 *   Settings -> Webhooks -> add `https://YOUR_DOMAIN/api/lemonsqueezy/webhook`
 *   Events: `order_created`
 *   Signing secret: any long random string; set the SAME value in
 *                   LEMONSQUEEZY_WEBHOOK_SECRET for now (single-tenant verify).
 *
 * If you eventually want per-tenant secrets, switch to looking up the secret
 * by store_id in the payload.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "LEMONSQUEEZY_WEBHOOK_SECRET not set" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyLemonSqueezySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    meta?: { event_name?: string; custom_data?: { kind?: string; payment_id?: string } };
    data?: {
      type?: string;
      attributes?: {
        total?: number;          // in cents
        currency?: string;
        order_number?: number;
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = event.meta?.event_name ?? "";
  const custom = event.meta?.custom_data ?? {};
  const attrs = event.data?.attributes ?? {};

  // We only care about completed orders for an Orbit invoice
  if (eventName !== "order_created" || custom.kind !== "invoice" || !custom.payment_id) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const supabase = createServiceClient();
  const paidAmount = attrs.total ? attrs.total / 100 : null;

  const { error } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_amount: paidAmount,
      remaining_balance: 0,
      payment_completed_at: new Date().toISOString(),
      webhook_verified: true,
    })
    .eq("id", custom.payment_id);
  if (error) {
    console.error("[lemonsqueezy] invoice update failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // In-app notification
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("client_name, user_id, invoice_number")
    .eq("id", custom.payment_id)
    .single();
  if (paymentRow?.user_id) {
    const formatted = paidAmount != null ? `$${paidAmount.toFixed(2)}` : "Payment";
    await notify(supabase, {
      userId: paymentRow.user_id,
      type: "payment_received",
      title: `${paymentRow.client_name ?? "A client"} paid your invoice`,
      body: paymentRow.invoice_number
        ? `Invoice ${paymentRow.invoice_number} - ${formatted} received via Lemon Squeezy.`
        : `${formatted} received via Lemon Squeezy.`,
      actionUrl: `/payments/${custom.payment_id}`,
      metadata: { payment_id: custom.payment_id, amount: paidAmount, provider: "lemonsqueezy" },
    });
  }

  return NextResponse.json({ received: true });
}
