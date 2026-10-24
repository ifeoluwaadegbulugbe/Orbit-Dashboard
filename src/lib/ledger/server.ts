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
