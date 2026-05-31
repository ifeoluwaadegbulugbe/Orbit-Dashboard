import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

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

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_WEBHOOK_SECRET_KEY ?? "placeholder";
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn("[webhook/stripe] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_link.completed":
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.CheckoutSession;
        const orbitPaymentId = session.metadata?.orbit_payment_id;
        if (!orbitPaymentId) break;
        const paidAmount = session.amount_total ? session.amount_total / 100 : null;
        console.log(`[webhook/stripe] Payment succeeded. orbit_payment_id=${orbitPaymentId} amount=${paidAmount} session=${session.id}`);
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orbitPaymentId = intent.metadata?.orbit_payment_id;
        if (!orbitPaymentId) break;
        const paidAmount = intent.amount_received ? intent.amount_received / 100 : null;
        console.log(`[webhook/stripe] PaymentIntent succeeded. orbit_payment_id=${orbitPaymentId} amount=${paidAmount}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orbitPaymentId = intent.metadata?.orbit_payment_id;
        if (!orbitPaymentId) break;
        const failureReason = intent.last_payment_error?.message ?? "Payment declined";
        console.log(`[webhook/stripe] Payment failed. orbit_payment_id=${orbitPaymentId} reason="${failureReason}"`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[webhook/stripe] Error processing event:", event.type, err);
    return NextResponse.json({ error: "Internal error processing event." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
