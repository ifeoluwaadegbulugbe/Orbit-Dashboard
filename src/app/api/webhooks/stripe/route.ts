// app/api/webhooks/stripe/route.ts
//
// Stripe calls this URL automatically whenever something happens in a connected
// account — e.g. a customer successfully pays an invoice.
//
// SETUP REQUIRED (one-time, by you):
//   1. Go to https://dashboard.stripe.com/webhooks
//   2. Click "Add endpoint"
//   3. URL: https://YOUR-DOMAIN.com/api/webhooks/stripe
//   4. Events to listen for:
//        - payment_link.completed
//        - checkout.session.completed
//        - payment_intent.succeeded
//        - payment_intent.payment_failed
//   5. After saving, Stripe shows you a "Signing secret" (starts with whsec_).
//      Copy it to your .env file as:  STRIPE_WEBHOOK_SECRET=whsec_...
//
// HOW IT WORKS:
//   When a customer pays, Stripe sends a POST request to this URL with a JSON
//   body describing what happened. We verify the request is genuinely from
//   Stripe (using the signature header), then update the matching payment record
//   in our database.
//
// IMPORTANT — raw body:
//   Stripe's signature verification requires the raw request body (bytes),
//   NOT the parsed JSON. We must read it as text before doing anything else.
//   The `export const config` at the bottom disables Next.js's default body
//   parsing for this route.

import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// You'll need to replace this import with however YOUR project accesses
// the database. If you use Supabase, Prisma, Drizzle, etc. — swap it in here.
// The key thing is: call whatever function updates a payment record's status.
// import { db } from "@/lib/db";

// ─── Events we care about ────────────────────────────────────────────────────

// Stripe fires many events. We only act on these four:
//   payment_link.completed    — customer finished paying via a Payment Link
//   checkout.session.completed — customer finished a Checkout Session
//   payment_intent.succeeded  — underlying payment succeeded
//   payment_intent.payment_failed — payment was declined or failed

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Read the raw body — MUST be text, not parsed JSON
  const rawBody = await request.text();

  // 2. Get the Stripe signature header
  //    Stripe sends this with every webhook request so we can verify it's real
  const signature = headers().get("stripe-signature");

  if (!signature) {
    console.warn("[webhook/stripe] Request missing stripe-signature header");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  // 3. Verify the webhook signature
  //    This proves the request came from Stripe, not a random attacker
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "[webhook/stripe] STRIPE_WEBHOOK_SECRET is not set in environment variables. " +
      "Add it to your .env file."
    );
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 500 }
    );
  }

  // We use a single shared Stripe instance just for webhook verification.
  // This does NOT need to be a per-user key — verification uses YOUR webhook secret.
  const stripe = new Stripe(
    process.env.STRIPE_WEBHOOK_SECRET_KEY ?? "placeholder", // Not used for verification
    { apiVersion: "2026-05-27.dahlia" }
  );

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn("[webhook/stripe] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature. Is your STRIPE_WEBHOOK_SECRET correct?" },
      { status: 400 }
    );
  }

  // 4. Handle the event
  //    We use the metadata.orbit_payment_id field (which we set when creating
  //    the Payment Link) to find and update the correct payment record.

  try {
    switch (event.type) {

      // ── Happy path: payment succeeded ──────────────────────────────────

      case "payment_link.completed":
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.CheckoutSession;
        const orbitPaymentId = session.metadata?.orbit_payment_id;

        if (!orbitPaymentId) {
          // This can happen if a payment wasn't created through Orbit.
          // Just skip it — not an error.
          break;
        }

        // Amount in cents → major unit (e.g. 4999 → 49.99)
        const paidAmount = session.amount_total
          ? session.amount_total / 100
          : null;

        // TODO: Replace this comment block with your actual DB update call.
        // Example for Prisma:
        //   await db.payment.update({
        //     where: { id: orbitPaymentId },
        //     data: {
        //       status: "paid",
        //       paid_amount: paidAmount,
        //       remaining_balance: 0,
        //       payment_provider: "stripe",
        //       payment_completed_at: new Date().toISOString(),
        //       stripe_checkout_session_id: session.id,
        //       webhook_verified: true,
        //     },
        //   });

        console.log(
          `[webhook/stripe] Payment succeeded. ` +
          `orbit_payment_id=${orbitPaymentId} amount=${paidAmount} session=${session.id}`
        );
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orbitPaymentId = intent.metadata?.orbit_payment_id;

        if (!orbitPaymentId) break;

        const paidAmount = intent.amount_received
          ? intent.amount_received / 100
          : null;

        // TODO: Same DB update as above, using intent.id as stripe_payment_intent_id.
        console.log(
          `[webhook/stripe] PaymentIntent succeeded. ` +
          `orbit_payment_id=${orbitPaymentId} amount=${paidAmount}`
        );
        break;
      }

      // ── Sad path: payment failed ────────────────────────────────────────

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orbitPaymentId = intent.metadata?.orbit_payment_id;

        if (!orbitPaymentId) break;

        const failureReason =
          intent.last_payment_error?.message ?? "Payment declined";

        // TODO:
        //   await db.payment.update({
        //     where: { id: orbitPaymentId },
        //     data: { status: "failed" },
        //   });

        console.log(
          `[webhook/stripe] Payment failed. ` +
          `orbit_payment_id=${orbitPaymentId} reason="${failureReason}"`
        );
        break;
      }

      // ── Everything else: ignore ─────────────────────────────────────────

      default:
        // Stripe sends many other event types. We don't need to handle them all.
        break;
    }
  } catch (err) {
    console.error("[webhook/stripe] Error processing event:", event.type, err);
    // Return 500 so Stripe knows to retry this event later
    return NextResponse.json(
      { error: "Internal error processing event." },
      { status: 500 }
    );
  }

  // 5. Always return 200 to tell Stripe "we got it"
  //    If we return anything else, Stripe will keep retrying the webhook.
  return NextResponse.json({ received: true });
}



