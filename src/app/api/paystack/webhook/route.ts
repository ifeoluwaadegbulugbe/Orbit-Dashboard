import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/paystack/server";
import { recordWebhookEvent, markWebhookProcessed } from "@/lib/ledger/server";
import { chargeMetadata, handleDispute, handleDisputeResolved, handleLegacyInvoiceCharge, handleOrbitPaySuccess, handleRefundEvent } from "@/lib/orbit-pay/webhook";
import { notify } from "@/lib/notifications/server";
import { trackEvent } from "@/lib/lifecycle/events";
import { planCodeOf, proPlanCodes } from "@/lib/pricing";
import { track } from "@/lib/analytics/server";

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

      // ── 1. Orbit Pay: paid through a split, so the business's share is
      // already on its way to their own bank. We only record it. ──
      const orbitMeta = chargeMetadata(event.data as Parameters<typeof chargeMetadata>[0]);
      if (orbitMeta.kind === "orbit_pay") {
        const problem = await handleOrbitPaySuccess(supabase, event.data as Parameters<typeof handleOrbitPaySuccess>[1]);
        if (problem) {
          console.error("[orbit-pay]", problem);
          await markWebhookProcessed(supabase, { provider: "paystack", providerEventId, error: problem });
        }
        break;
      }

      // ── Old-style invoice links (before Orbit Pay) - see the handler. ──
      if (meta.kind === "invoice" && meta.payment_id) {
        const problem = await handleLegacyInvoiceCharge(supabase, data, meta.payment_id);
        await markWebhookProcessed(supabase, { provider: "paystack", providerEventId, error: problem });
        break;
      }

      // ── 2. Subscription charges (trial → paid, renewals) ──
      // Only charges on one of Orbit's Pro plans grant Pro - nothing else
      // that happens to carry a user_id or a matching email.
      const planCode = planCodeOf((event.data as { plan?: unknown }).plan);
      if (!planCode || !proPlanCodes().includes(planCode)) {
        console.warn("[paystack] charge.success not on an Orbit Pro plan - ignored", data.reference);
        break;
      }
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
        else if (userId) await trackEvent(userId, "subscription_started", { reference: data.reference ?? null });
      }
      break;
    }

    // ── Orbit Pay refunds and disputes ──
    case "refund.processed":
    case "refund.failed":
    case "refund.pending": {
      const problem = await handleRefundEvent(supabase, event.event, event.data as Parameters<typeof handleRefundEvent>[2]);
      if (problem) console.error("[orbit-pay]", problem);
      break;
    }
    case "charge.dispute.resolve": {
      await handleDisputeResolved(supabase, event.data as Parameters<typeof handleDisputeResolved>[1]);
      break;
    }
    case "charge.dispute.create": {
      await handleDispute(supabase, event.data as Parameters<typeof handleDispute>[1]);
      break;
    }

    case "subscription.create": {
      const data = event.data as {
        customer?: { email?: string };
        plan?: { plan_code?: string };
        subscription_code?: string;
      };
      const email = data.customer?.email;
      if (email && proPlanCodes().includes(planCodeOf(data.plan) ?? "")) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "pro" })
          .eq("email", email);
      }
      break;
    }

    // A Pro renewal charge failed (card declined, expired...). Recorded
    // for analytics only - the subscription.disable event handles access.
    case "invoice.payment_failed": {
      const data = event.data as { customer?: { email?: string }; invoice_code?: string };
      const email = data.customer?.email;
      if (email) {
        const { data: owner } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
        if (owner?.id) {
          await track(owner.id, "payment_failed", {
            actor: "system",
            dedupeKey: `payment_failed:${data.invoice_code ?? providerEventId}:${owner.id}`,
            props: { kind: "subscription", provider: "paystack" },
          });
        }
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

    // Orbit no longer makes payouts (transfer.* events are ignored).
    default:
      // Acknowledge but don't act on unknown events
      break;
  }

  await markWebhookProcessed(supabase, { provider: "paystack", providerEventId });
  return NextResponse.json({ received: true });
}

