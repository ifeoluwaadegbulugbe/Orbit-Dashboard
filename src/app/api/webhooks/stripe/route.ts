import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/server";
import { recordWebhookEvent, markWebhookProcessed, postInvoicePayment } from "@/lib/ledger/server";
import { recalcClientBalance } from "@/lib/payments/recalc-client-balance";

/**
 * Stripe webhook -> mark invoice payments paid, post to the wallet ledger.
 *
 * IMPORTANT LIMITATION: business owners connect their OWN Stripe account
 * (see /payment-settings) and their key never touches Orbit's database, so
 * there is no per-user webhook secret to verify against. This handler can
 * only verify signatures for the ONE Stripe account whose signing secret is
 * in STRIPE_WEBHOOK_SECRET. Events from any other user's Stripe account will
 * correctly fail signature verification (401) and be dropped. Supporting
 * every connected user's own Stripe webhook requires storing a per-user
 * webhook secret somewhere Orbit can look it up - a product decision, not
 * made here. Until then this path only works for a single Stripe account.
 */

interface StripeSessionMetadata {
  kind?: string;
  payment_id?: string;
  user_id?: string;
  client_id?: string;
  orbit_payment_id?: string; // legacy key from an earlier metadata scheme
}

interface StripeSession {
  id: string;
  metadata?: StripeSessionMetadata | null;
  amount_total?: number | null;
  currency?: string | null;
}

interface StripePaymentIntent {
  id: string;
  metadata?: StripeSessionMetadata | null;
  amount_received?: number | null;
  currency?: string | null;
  last_payment_error?: { message?: string } | null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.warn("[webhook/stripe] Request missing stripe-signature header");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "placeholder";
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn("[webhook/stripe] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency: store the raw payload before acting on it, keyed on
  // Stripe's own event id (globally unique, unlike the derived ids we have
  // to fall back to for Paystack/Flutterwave).
  const { isNew } = await recordWebhookEvent(supabase, {
    provider: "stripe",
    providerEventId: event.id,
    eventType: event.type,
    payload: event,
    signatureValid: true,
  });
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as StripeSession;
        const meta = session.metadata ?? {};
        const paymentId = meta.kind === "invoice" ? meta.payment_id : meta.orbit_payment_id;
        if (!paymentId) break;

        await handleInvoicePaid(supabase, {
          paymentId,
          reference: session.id,
          amountMinor: session.amount_total ?? null,
          currency: session.currency ?? "usd",
        });
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as unknown as StripePaymentIntent;
        const meta = intent.metadata ?? {};
        const paymentId = meta.kind === "invoice" ? meta.payment_id : meta.orbit_payment_id;
        if (!paymentId) break;

        await handleInvoicePaid(supabase, {
          paymentId,
          reference: intent.id,
          amountMinor: intent.amount_received ?? null,
          currency: intent.currency ?? "usd",
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as unknown as StripePaymentIntent;
        const meta = intent.metadata ?? {};
        const paymentId = meta.kind === "invoice" ? meta.payment_id : meta.orbit_payment_id;
        const failureReason = intent.last_payment_error?.message ?? "Payment declined";
        if (paymentId) {
          console.log(`[webhook/stripe] Payment failed. payment_id=${paymentId} reason="${failureReason}"`);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[webhook/stripe] Error processing event:", event.type, err);
    await markWebhookProcessed(supabase, {
      provider: "stripe",
      providerEventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error processing event." }, { status: 500 });
  }

  await markWebhookProcessed(supabase, { provider: "stripe", providerEventId: event.id });
  return NextResponse.json({ received: true });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function handleInvoicePaid(
  supabase: ReturnType<typeof createServiceClient>,
  params: { paymentId: string; reference: string; amountMinor: number | null; currency: string },
) {
  const paidAmount = params.amountMinor != null ? params.amountMinor / 100 : null;

  const { error } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_amount: paidAmount,
      remaining_balance: 0,
      payment_completed_at: new Date().toISOString(),
      transaction_reference: params.reference,
      webhook_verified: true,
    })
    .eq("id", params.paymentId);
  if (error) {
    console.error("[webhook/stripe] invoice update failed:", error);
    return;
  }

  const { data: paymentRow } = await supabase
    .from("payments")
    .select("client_id, client_name, user_id, invoice_number")
    .eq("id", params.paymentId)
    .single();

  if (paymentRow?.client_id) {
    await recalcClientBalance(supabase, paymentRow.client_id);
  }

  // Mirror the confirmed payment into the (non-custodial) wallet ledger.
  // Orbit never holds this money - it already landed in the business
  // owner's own Stripe account - this just records that it happened.
  if (paymentRow?.user_id && params.amountMinor) {
    await postInvoicePayment(supabase, {
      paymentId: params.paymentId,
      userId: paymentRow.user_id,
      amountMinor: params.amountMinor, // Stripe sends amount in minor units already
      currency: params.currency.toUpperCase(),
      provider: "stripe",
    });
  }

  if (paymentRow?.user_id) {
    const formatted = paidAmount != null ? paidAmount.toFixed(2) : "your invoice";
    await notify(supabase, {
      userId: paymentRow.user_id,
      type: "payment_received",
      title: `${paymentRow.client_name ?? "A client"} paid your invoice`,
      body: paymentRow.invoice_number
        ? `Invoice ${paymentRow.invoice_number} - ${formatted} received via Stripe.`
        : `${formatted} received via Stripe.`,
      actionUrl: `/payments/${params.paymentId}`,
      metadata: { payment_id: params.paymentId, amount: paidAmount, provider: "stripe" },
    });
  }
}
