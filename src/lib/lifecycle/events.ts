/**
 * Records product events that leave no other trace in the database
 * (checkout_started, subscription_started...). Things like "client created"
 * are read straight from their own tables instead of being duplicated here.
 * Never throws - tracking must not break the action being tracked.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export type ProductEvent = "checkout_started" | "subscription_started" | "upgrade_page_viewed";

export async function trackEvent(userId: string, event: ProductEvent, props: Record<string, unknown> = {}): Promise<void> {
  try {
    await createServiceClient().from("user_product_events").insert({ user_id: userId, event, props });
  } catch (err) {
    console.warn(`[events] could not record ${event}:`, err);
  }
}
