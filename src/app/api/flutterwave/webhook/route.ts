import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyFlutterwaveHash } from "@/lib/flutterwave/server";
import { notify } from "@/lib/notifications/server";

/**
 * Flutterwave webhook -> mark invoice payments paid.
 *
 * Configure in each business owner's Flutterwave dashboard:
 *   Settings -> Webhooks -> URL: https://YOUR_DOMAIN/api/flutterwave/webhook
 *   Secret hash: any long random string; SAME value in FLUTTERWAVE_WEBHOOK_HASH.
 *
 * If multiple Orbit users share this app instance, you can either:
 *   - Use the same shared hash for everyone (simpler), OR
 *   - Look up the hash per user by matching event.data.meta.user_id to a
 *     stored value (per-tenant security).
 *
 * We use the simpler shared-hash model for now. The payment_id in metadata
 * still routes the update to the right invoice.
 */
export async function POST(request: Request) {
  const headerHash = request.headers.get("verif-hash");
  const expectedHash = process.env.FLUTTERWAVE_WEBHOOK_HASH ?? null;

  if (!verifyFlutterwaveHash(headerHash, expectedHash)) {
    return NextResponse.json({ error: "Invalid hash" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      meta?: { kind?: string; payment_id?: string };
    };
  };
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = event.data ?? {};
  const meta = data.meta ?? {};
  const isSuccess = data.status === "successful" || data.status === "completed";

  if (isSuccess && meta.kind === "invoice" && meta.payment_id) {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("payments")
      .update({
        status: "paid",
        paid_amount: data.amount ?? null,
        remaining_balance: 0,
        payment_completed_at: new Date().toISOString(),
        webhook_verified: true,
      })
      .eq("id", meta.payment_id);
    if (error) console.error("[flutterwave] invoice update failed:", error);

    // In-app notification
    const { data: paymentRow } = await supabase
      .from("payments")
      .select("client_name, user_id, invoice_number")
      .eq("id", meta.payment_id)
      .single();
    if (paymentRow?.user_id) {
      await notify(supabase, {
        userId: paymentRow.user_id,
        type: "payment_received",
        title: `${paymentRow.client_name ?? "A client"} paid your invoice`,
        body: paymentRow.invoice_number
          ? `Invoice ${paymentRow.invoice_number} - ${data.amount ?? ""} received via Flutterwave.`
          : `${data.amount ?? "Payment"} received via Flutterwave.`,
        actionUrl: `/payments/${meta.payment_id}`,
        metadata: { payment_id: meta.payment_id, amount: data.amount, provider: "flutterwave" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
