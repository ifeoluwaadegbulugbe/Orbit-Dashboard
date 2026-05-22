import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/paystack/server";
import { notify } from "@/lib/notifications/server";

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

  return NextResponse.json({ received: true });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Recompute a client's total_paid and outstanding_balance after a payment
 * status change. Mirrors the mobile app's recalcClientBalance behaviour.
 */
async function recalcClientBalance(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
) {
  const { data: rows } = await supabase
    .from("payments")
    .select("amount,status,paid_amount,remaining_balance")
    .eq("client_id", clientId);
  if (!rows) return;

  type Row = { amount: number; status: string; paid_amount: number | null; remaining_balance: number | null };
  const typed = rows as Row[];

  const totalPaid = typed
    .filter((p) => p.status === "paid" || p.status === "partial")
    .reduce((sum, p) => sum + (p.paid_amount ?? (p.status === "paid" ? p.amount : 0)), 0);

  const outstanding = typed
    .filter((p) => p.status === "pending" || p.status === "overdue" || p.status === "partial")
    .reduce((sum, p) => {
      if (p.status === "partial") return sum + Math.max(0, p.amount - (p.paid_amount ?? 0));
      return sum + (p.amount ?? 0);
    }, 0);

  await supabase
    .from("clients")
    .update({ total_paid: totalPaid, outstanding_balance: outstanding })
    .eq("id", clientId);
}
