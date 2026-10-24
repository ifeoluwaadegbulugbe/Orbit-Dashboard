/**
 * Server-side helper to insert an in-app notification for a user.
 * Used by webhook handlers and public API routes after meaningful events.
 *
 * Fails silently if the notifications table doesn't exist yet, so the host
 * route's main job (e.g. processing a payment) still succeeds.
 */

import "server-only";
import type { NotificationType } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push/server";

/**
 * Also sent to the owner's phone (push). Left out: things the owner just
 * did themselves (confirming/cancelling a booking) and the welcome note.
 */
const PUSH_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "booking_received", "payment_received", "invoice_overdue", "reminder_due",
  "trial_ending", "trial_expired", "subscription_failed", "client_birthday", "review_received",
]);

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Insert a notification. Pass an already-constructed service-role client so
 * we don't keep re-creating one (and so callers can reuse their own).
 */
export async function notify(
  supabase: SupabaseClient,
  params: NotifyParams,
): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      action_url: params.actionUrl ?? null,
      metadata: params.metadata ?? null,
      is_read: false,
    });
    if (error) {
      // Don't crash the host request - just log
      console.warn("[notify] insert failed:", error.message);
    }
    if (PUSH_TYPES.has(params.type)) {
      const m = params.metadata ?? {};
      await sendPushToUser(supabase, params.userId, {
        title: params.title,
        body: params.body,
        url: params.actionUrl,
        // Matches the in-app reminder's tag, so an open tab and the push
        // don't show the same appointment twice.
        tag: m.booking_id && m.minutes_until
          ? `orbit-booking-${m.booking_id}-${m.minutes_until}`
          : `orbit-${params.type}-${String(m.booking_id ?? m.payment_id ?? Date.now())}`,
      });
    }
  } catch (err) {
    console.warn("[notify] unexpected error:", err);
  }
}
