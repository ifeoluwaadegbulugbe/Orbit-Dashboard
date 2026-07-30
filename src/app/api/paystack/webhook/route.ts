import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/paystack/server";
import { notify } from "@/lib/notifications/server";
import { recordWebhookEvent, markWebhookProcessed, postInvoicePayment } from "@/lib/ledger/server";
import { recalcClientBalance } from "@/lib/payments/recalc-client-balance";

/**
 * Paystack webhook → subscription status sync.
 *
 * Configure your webhook URL in Paystack dashboard → Settings → Webhooks:
 *   https://YOUR_DOMAIN/api/paystack/webhook
 *
 * Events handled:
 *   - charge.success        → user paid; ensure status = 'pro'
 *   - subscription.create   → new subscription created
 *   - subscription.disable  → cancelled / expired → revert to 'free'
 *   - subscription.not_renew → mark as ending; still pro until next_payment_date
 *   - invoice.payment_failed → don't downgrade immediately; Paystack retries
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency: store the raw payload before acting on it. Paystack retries
  // webhooks on any non-2xx or timeout, so duplicate deliveries are expected,
  // not hypothetical. `data.id` (the numeric transaction id) is stable across
  // retries of the same event; `reference` is the fallback for event types
  // that omit it.
  const eventData = event.data as { id?: number | string; reference?: string };
  const providerEventId = String(eventData.id ?? eventData.reference ?? `${event.event}:unknown`);
  const { isNew } = await recordWebhookEvent(supabase, {
    provider: "paystack",
    providerEventId,
    eventType: event.event,
    payload: event,
    signatureValid: true,
  });
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.event) {
    case "charge.success": {
      const data = event.data as {
        amount?: number;
        customer?: { email?: string };
        reference?: string;
        metadata?: { user_id?: string; kind?: string; payment_id?: string };
        plan?: string;
      };
      const meta = data.metadata ?? {};

      // ── 1. Invoice charges - mark the specific invoice as paid ──
      // These are one-off transactions created via /api/payments/:id/link.
      if (meta.kind === "invoice" && meta.payment_id) {
        const paidAmount = data.amount ? data.amount / 100 : null;
        const { error } = await supabase
          .from("payments")
          .update({
            status: "paid",
            paid_amount: paidAmount,
            remaining_balance: 0,
            payment_completed_at: new Date().toISOString(),
            transaction_reference: data.reference ?? null,
            webhook_verified: true,
          })
          .eq("id", meta.payment_id);
        if (error) console.error("[paystack] invoice charge.success update failed:", error);

        // Best-effort: recalculate the client's outstanding balance + total paid
        const { data: paymentRow } = await supabase
          .from("payments")
          .select("client_id, client_name, user_id, invoice_number")
          .eq("id", meta.payment_id)
          .single();
        if (paymentRow?.client_id) {
          await recalcClientBalance(supabase, paymentRow.client_id);
        }

        // Mirror the confirmed payment into the (non-custodial) wallet ledger.
        // Orbit never holds this money - it already landed in the business
        // owner's own Paystack account - this just records that it happened.
        if (paymentRow?.user_id && data.amount) {
          await postInvoicePayment(supabase, {
            paymentId: meta.payment_id,
            userId: paymentRow.user_id,
            amountMinor: data.amount, // Paystack sends amount in kobo already
            currency: "NGN",
            provider: "paystack",
          });
        }

        // In-app notification for the business owner
        if (paymentRow?.user_id) {
          const formatted = paidAmount != null ? paidAmount.toFixed(2) : "your invoice";
          await notify(supabase, {
            userId: paymentRow.user_id,
            type: "payment_received",
            title: `${paymentRow.client_name ?? "A client"} paid your invoice`,
            body: paymentRow.invoice_number
              ? `Invoice ${paymentRow.invoice_number} - ${formatted} received via Paystack.`
              : `${formatted} received via Paystack.`,
            actionUrl: `/payments/${meta.payment_id}`,
            metadata: { payment_id: meta.payment_id, amount: paidAmount, provider: "paystack" },
          });
        }
        break;
      }

      // ── 2. Subscription charges (trial → paid, renewals) ──
      const userId = meta.user_id;
      const email = data.customer?.email;
      if (userId || email) {
        const query = supabase
          .from("profiles")
          .update({ subscription_status: "pro", trial_ends_at: null });
        const { error } = userId
          ? await query.eq("id", userId)
          : await query.eq("email", email!);
        if (error) console.error("[paystack] charge.success subscription update failed:", error);
      }
      break;
    }

    case "subscription.create": {
      const data = event.data as {
        customer?: { email?: string };
        plan?: { plan_code?: string };
        subscription_code?: string;
      };
      const email = data.customer?.email;
      if (email) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "pro" })
          .eq("email", email);
      }
      break;
    }

    case "subscription.disable":
    case "subscription.expiring_cards": {
      const data = event.data as { customer?: { email?: string } };
      const email = data.customer?.email;
      if (email) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "free", trial_ends_at: null })
          .eq("email", email);
      }
      break;
    }

    default:
      // Acknowledge but don't act on unknown events
      break;
  }

  await markWebhookProcessed(supabase, { provider: "paystack", providerEventId });
  return NextResponse.json({ received: true });
}

