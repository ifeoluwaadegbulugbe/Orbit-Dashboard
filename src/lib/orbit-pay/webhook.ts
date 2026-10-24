/**
 * Paystack webhook handling for Orbit Pay. The route verifies the signature
 * and records each event once (webhook_events) before calling these, so a
 * redelivery never reaches here twice. Everything here only RECORDS what
 * Paystack reports - money moves between Paystack and the business's bank,
 * never through Orbit.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recalcClientBalance } from "@/lib/payments/recalc-client-balance";
import { notify } from "@/lib/notifications/server";
import { track } from "@/lib/analytics/server";
import { sendEmail } from "@/lib/email/server";
import { appUrl } from "@/lib/app-url";
import { renderEmail } from "@/lib/email-design/render";
import { paymentReceivedEmail } from "@/lib/email-design/templates";
import { expectedPayoutDate, formatPayoutDate, shortBankName } from "./payout";

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

interface ChargeData {
  amount?: number;
  fees?: number | null;
  reference?: string;
  channel?: string;
  paid_at?: string;
  authorization?: { country_code?: string | null };
  subaccount?: { subaccount_code?: string } | null;
  metadata?: { kind?: string; charge_id?: string; payment_id?: string } | string | null;
}

export function chargeMetadata(data: ChargeData): { kind?: string; charge_id?: string; payment_id?: string } {
  if (typeof data.metadata === "string") {
    try { return JSON.parse(data.metadata); } catch { return {}; }
  }
  return data.metadata ?? {};
}

/** charge.success for an Orbit Pay link. Returns an error string if something didn't add up. */
export async function handleOrbitPaySuccess(supabase: SupabaseClient, data: ChargeData): Promise<string | null> {
  const meta = chargeMetadata(data);
  if (!meta.charge_id) return "orbit_pay charge without charge_id";
  const { data: charge } = await supabase.from("orbit_pay_charges").select("*").eq("id", meta.charge_id).maybeSingle();
  if (!charge) return `unknown orbit_pay charge ${meta.charge_id}`;

  // Paid exactly one of the two prices fixed when the link was made, and
  // to this business's own subaccount - anything else is flagged, not booked.
  const paid = Number(data.amount ?? 0);
  const region = paid === Number(charge.charge_kobo) ? "local" : paid === Number(charge.intl_charge_kobo) ? "international" : null;
  const sub = data.subaccount?.subaccount_code;
  if (!region) return `amount mismatch on charge ${charge.id}: paid ${paid}`;
  if (sub && sub !== charge.subaccount_code) return `subaccount mismatch on charge ${charge.id}`;

  const now = new Date().toISOString();
  await supabase.from("orbit_pay_charges").update({
    status: "success",
    reference: data.reference ?? charge.reference,
    paid_kobo: paid,
    paystack_fee_kobo: typeof data.fees === "number" ? data.fees : null,
    channel: data.channel ?? null,
    card_country: data.authorization?.country_code ?? null,
    card_region: region,
    paid_at: data.paid_at ?? now,
    updated_at: now,
  }).eq("id", charge.id);

  const serviceNaira = Number(charge.service_kobo) / 100;
  const { data: payment } = await supabase.from("payments").update({
    status: "paid",
    paid_amount: serviceNaira,
    remaining_balance: 0,
    payment_completed_at: now,
    transaction_reference: data.reference ?? null,
    webhook_verified: true,
  }).eq("id", charge.payment_id).select("id, client_id, client_name, invoice_number").maybeSingle();
  if (payment?.client_id) await recalcClientBalance(supabase, payment.client_id);

  const userId = charge.user_id as string;
  await track(userId, "payment_received", {
    actor: "system",
    dedupeKey: `payment_received:${charge.payment_id}:${userId}`,
    props: { kind: "orbit_pay", region, channel: data.channel ?? null },
  });

  const settles = Number(charge.charge_kobo) === paid ? paid - Number(charge.fee_kobo) : paid - Number(charge.intl_fee_kobo);
  const client = payment?.client_name ?? "A client";
  const { data: acct } = await supabase.from("orbit_pay_accounts").select("bank_name").eq("user_id", userId).maybeSingle();
  const arrives = `${naira(settles)} arrives in your ${shortBankName(acct?.bank_name)} account by ${formatPayoutDate(expectedPayoutDate(data.paid_at ?? now))}.`;
  await notify(supabase, {
    userId,
    type: "payment_received",
    title: `${client} paid ${naira(Number(charge.service_kobo))}`,
    body: `${payment?.invoice_number ? `Invoice ${payment.invoice_number}. ` : ""}${arrives}`,
    actionUrl: `/payments/${charge.payment_id}`,
    metadata: { payment_id: charge.payment_id, charge_id: charge.id },
  });

  // Transactional "Someone paid you" email (about their money - not optional).
  const { data: owner } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (owner?.email) {
    const base = appUrl();
    const { html, text } = renderEmail(
      paymentReceivedEmail({
        amount: naira(Number(charge.service_kobo)),
        clientName: client,
        invoiceNumber: payment?.invoice_number ?? null,
        paymentPath: `/payments/${charge.payment_id}`,
        url: (path) => `${base}${path}`,
        payoutNote: `${arrives} Paystack pays out on the next business day.`,
      }),
      { appUrl: base, reason: "You're getting this because a client paid you through Orbit Pay." },
    );
    const sent = await sendEmail({ to: owner.email, subject: "Someone paid you", html, text });
    if (!sent.ok && !sent.skipped) console.warn("[orbit-pay] payment email failed:", sent.error);
  }
  return null;
}

/**
 * charge.success on a pre-Orbit-Pay link (money landed in Orbit's own
 * Paystack balance). Still mark the invoice paid so the client isn't
 * chased, but flag it loudly: that money must be settled to the business
 * by hand. Migration 021 clears these links, so this should never happen.
 */
export async function handleLegacyInvoiceCharge(supabase: SupabaseClient, data: ChargeData, paymentId: string): Promise<string> {
  await supabase.from("payments").update({
    status: "paid",
    paid_amount: data.amount ? data.amount / 100 : null,
    remaining_balance: 0,
    payment_completed_at: new Date().toISOString(),
    transaction_reference: data.reference ?? null,
    webhook_verified: true,
  }).eq("id", paymentId);
  const { data: p } = await supabase.from("payments").select("client_id").eq("id", paymentId).maybeSingle();
  if (p?.client_id) await recalcClientBalance(supabase, p.client_id);
  const msg = `LEGACY non-split payment ${data.reference} for invoice ${paymentId}: funds are in Orbit's Paystack balance and must be refunded or settled manually`;
  console.error(`[orbit-pay] ${msg}`);
  return msg;
}

interface RefundData {
  status?: string;
  amount?: number;
  transaction_reference?: string;
  transaction?: { reference?: string } | null;
}

/** refund.processed / refund.failed / refund.pending */
export async function handleRefundEvent(supabase: SupabaseClient, eventType: string, data: RefundData): Promise<string | null> {
  const reference = data.transaction_reference ?? data.transaction?.reference;
  if (!reference) return "refund event without transaction reference";
  const { data: charge } = await supabase.from("orbit_pay_charges").select("*").eq("reference", reference).maybeSingle();
  if (!charge) return null; // not an Orbit Pay charge (e.g. a subscription) - nothing to record

  if (eventType === "refund.failed") {
    await notify(supabase, {
      userId: charge.user_id, type: "payment_received", title: "A refund didn't go through",
      body: "Paystack couldn't complete a refund you started. Check your Paystack settlement or try again.",
      actionUrl: `/payments/${charge.payment_id}`, metadata: { charge_id: charge.id },
    });
    return null;
  }
  if (eventType !== "refund.processed") return null;

  const refunded = Number(charge.refunded_kobo ?? 0) + Number(data.amount ?? 0);
  const full = refunded >= Number(charge.paid_kobo ?? charge.charge_kobo);
  await supabase.from("orbit_pay_charges").update({
    refunded_kobo: refunded, status: full ? "refunded" : "partially_refunded", updated_at: new Date().toISOString(),
  }).eq("id", charge.id);
  if (full) await supabase.from("payments").update({ status: "refunded" }).eq("id", charge.payment_id);
  return null;
}

/** charge.dispute.create - the client's bank is disputing a payment. */
// The payment reference's place in dispute events isn't in Paystack's
// published reference, so both likely places are checked.
type DisputeData = { transaction?: { reference?: string } | null; transaction_reference?: string; resolution?: string | null };
const disputeRef = (d: DisputeData) => d.transaction?.reference ?? d.transaction_reference;

export async function handleDispute(supabase: SupabaseClient, data: DisputeData): Promise<string | null> {
  const reference = disputeRef(data);
  if (!reference) return null;
  const { data: charge } = await supabase.from("orbit_pay_charges").select("id, user_id, payment_id").eq("reference", reference).maybeSingle();
  if (!charge) return null;
  await supabase.from("orbit_pay_charges").update({ status: "disputed", updated_at: new Date().toISOString() }).eq("id", charge.id);
  await notify(supabase, {
    userId: charge.user_id, type: "payment_received", title: "A client's bank disputed a payment",
    body: "Paystack will email you about it. If the dispute is lost, the amount comes out of your settlements.",
    actionUrl: `/payments/${charge.payment_id}`, metadata: { charge_id: charge.id },
  });
  return null;
}

/** charge.dispute.resolve - tell the owner how it ended; their Paystack email has the details. */
export async function handleDisputeResolved(supabase: SupabaseClient, data: DisputeData): Promise<string | null> {
  const reference = disputeRef(data);
  if (!reference) return null;
  const { data: charge } = await supabase.from("orbit_pay_charges").select("id, user_id, payment_id").eq("reference", reference).maybeSingle();
  if (!charge) return null;
  const merchantWon = /declined|merchant/i.test(String(data.resolution ?? "")) && !/accepted/i.test(String(data.resolution ?? ""));
  await supabase.from("orbit_pay_charges").update({
    status: merchantWon ? "success" : "refunded", updated_at: new Date().toISOString(),
  }).eq("id", charge.id);
  await notify(supabase, {
    userId: charge.user_id, type: "payment_received",
    title: merchantWon ? "A payment dispute was settled in your favour" : "A payment dispute was settled for the client",
    body: "Check your Paystack email for the details.",
    actionUrl: `/payments/${charge.payment_id}`, metadata: { charge_id: charge.id },
  });
  return null;
}
