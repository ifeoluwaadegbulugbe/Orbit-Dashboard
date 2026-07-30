import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/paystack/server";
import { recordWebhookEvent, markWebhookProcessed } from "@/lib/ledger/server";

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
        metadata?: { user_id?: string };
        plan?: string;
      };
      const meta = data.metadata ?? {};

      // Subscription charges (trial → paid, renewals). This webhook only
      // handles Orbit's own Pro subscription billing - invoice payment
      // collection was removed along with the "connect your own account"
      // flow (see Orbit Wallet).
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

