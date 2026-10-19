/**
 * Records product events for the lifecycle engine. Now a thin wrapper over
 * the product-analytics tracker, so these also reach the admin dashboard
 * and PostHog. Never throws - tracking must not break the action tracked.
 */

import "server-only";
import { track } from "@/lib/analytics/server";

export type ProductEvent = "checkout_started" | "subscription_started" | "upgrade_page_viewed";

export async function trackEvent(userId: string, event: ProductEvent, props: Record<string, string | number | boolean | null> = {}): Promise<void> {
  await track(userId, event, { props });
}
