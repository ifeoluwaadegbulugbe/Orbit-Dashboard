import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;

interface RecordWebhookEventParams {
  provider: "paystack" | "stripe" | "flutterwave";
  providerEventId: string;
  eventType?: string;
  payload: unknown;
  signatureValid: boolean;
}

/**
 * Insert the raw webhook payload before any processing, keyed on the
 * provider's own event id. Returns `isNew: false` when that id was already
 * stored — a provider retry — so the caller can skip re-applying side
 * effects instead of double-processing.
 */
export async function recordWebhookEvent(
  supabase: ServiceClient,
  params: RecordWebhookEventParams,
): Promise<{ isNew: boolean }> {
  const { error } = await supabase.from("webhook_events").insert({
    provider: params.provider,
    provider_event_id: params.providerEventId,
    event_type: params.eventType ?? null,
    payload: params.payload as object,
    signature_valid: params.signatureValid,
  });

  if (error) {
    // 23505 = unique_violation on (provider, provider_event_id): already seen this event.
    if (error.code === "23505") return { isNew: false };
    console.error("[ledger] failed to record webhook_events row:", error);
  }
  return { isNew: true };
}

export async function markWebhookProcessed(
  supabase: ServiceClient,
  params: { provider: string; providerEventId: string; error?: string },
) {
  const { error } = await supabase
    .from("webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_error: params.error ?? null,
    })
    .eq("provider", params.provider)
    .eq("provider_event_id", params.providerEventId);
  if (error) console.error("[ledger] failed to mark webhook_events processed:", error);
}

interface PostInvoicePaymentParams {
  paymentId: string;
  userId: string;
  amountMinor: number;
  currency: string;
  provider: string;
}

/**
 * Posts a payment_processor_clearing -> user_wallet ledger transaction for
 * a confirmed invoice payment. Idempotent on payment id (see
 * post_invoice_payment / post_ledger_transaction in migration 006).
 *
 * Deliberately non-throwing: this is additive bookkeeping on top of the
 * existing `payments.status` update, which stays the source of truth for
 * the rest of the app. If the ledger migrations haven't been applied yet,
 * or the RPC call fails for any other reason, we log and move on rather
 * than breaking the invoice-paid flow that already works today.
 */
export async function postInvoicePayment(
  supabase: ServiceClient,
  params: PostInvoicePaymentParams,
): Promise<string | null> {
  if (!(params.amountMinor > 0)) {
    console.warn("[ledger] skipping post_invoice_payment: non-positive amount", params);
    return null;
  }
  const { data, error } = await supabase.rpc("post_invoice_payment", {
    p_payment_id: params.paymentId,
    p_user_id: params.userId,
    p_amount_minor: Math.round(params.amountMinor),
    p_currency: params.currency,
    p_provider: params.provider,
  });
  if (error) {
    console.error("[ledger] post_invoice_payment failed:", error);
    return null;
  }
  return data as string;
}

interface PostInvoicePaymentWithFeeParams {
  paymentId: string;
  userId: string;
  netAmountMinor: number;
  feeAmountMinor: number;
  currency: string;
  provider: string;
}

/**
 * Same idea as postInvoicePayment, but for the Paystack-backed custody
 * rail: splits the payment into the user's net share and Orbit's platform
 * fee as two separate, independently auditable ledger transactions (see
 * post_invoice_payment_with_fee in migration 011). Also non-throwing -
 * see the comment on postInvoicePayment for why.
 */
export async function postInvoicePaymentWithFee(
  supabase: ServiceClient,
  params: PostInvoicePaymentWithFeeParams,
): Promise<string | null> {
  if (!(params.netAmountMinor > 0)) {
    console.warn("[ledger] skipping post_invoice_payment_with_fee: non-positive net amount", params);
    return null;
  }
  const { data, error } = await supabase.rpc("post_invoice_payment_with_fee", {
    p_payment_id: params.paymentId,
    p_user_id: params.userId,
    p_net_amount_minor: Math.round(params.netAmountMinor),
    p_fee_amount_minor: Math.round(params.feeAmountMinor),
    p_currency: params.currency,
    p_provider: params.provider,
  });
  if (error) {
    console.error("[ledger] post_invoice_payment_with_fee failed:", error);
    return null;
  }
  return data as string;
}
