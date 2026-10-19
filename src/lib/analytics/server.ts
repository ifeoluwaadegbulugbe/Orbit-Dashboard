/**
 * Server-side event tracking - the one path every product event takes.
 *
 *   1. Insert into user_product_events (Orbit's own event log, which the
 *      admin dashboard reads). A dedupe_key makes the same real-world action
 *      count once, however many times it's reported (retries, webhook
 *      redeliveries, double clicks).
 *   2. Only if that row is new, forward it to PostHog - after the response
 *      has been sent, so analytics never slows down or breaks the action.
 *
 * Never throws.
 */

import "server-only";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { EVENTS, type Actor, type EventName } from "./catalog";

export interface TrackOptions {
  actor?: Actor;
  /** Same key = same action; only the first one is recorded. */
  dedupeKey?: string;
  /** Non-sensitive context only: ids, counts, kinds. Never names, messages, amounts tied to people, or credentials. */
  props?: Record<string, string | number | boolean | null>;
}

export async function track(userId: string, event: EventName, opts: TrackOptions = {}): Promise<{ recorded: boolean }> {
  const actor = opts.actor ?? "owner";
  const props = opts.props ?? {};
  const now = new Date();
  try {
    const supabase = createServiceClient();
    let { error } = await supabase.from("user_product_events").insert({
      user_id: userId, event, props, actor, dedupe_key: opts.dedupeKey ?? null, created_at: now.toISOString(),
    });
    if (error?.code === "23505") return { recorded: false }; // already recorded
    if (error && /actor|dedupe_key/.test(error.message)) {
      // Migration 019 not run yet - keep recording without the new columns.
      ({ error } = await supabase.from("user_product_events").insert({ user_id: userId, event, props: { ...props, actor } }));
    }
    if (error) {
      console.warn(`[analytics] could not record ${event}:`, error.message);
      return { recorded: false };
    }
  } catch (err) {
    console.warn(`[analytics] could not record ${event}:`, err);
    return { recorded: false };
  }

  forwardToPostHog(userId, event, actor, props, now, opts.dedupeKey);
  return { recorded: true };
}

/** PostHog's public capture endpoint. No-op without NEXT_PUBLIC_POSTHOG_KEY. */
function forwardToPostHog(
  userId: string, event: EventName, actor: Actor,
  props: Record<string, unknown>, at: Date, dedupeKey?: string,
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");
  const send = async () => {
    try {
      await fetch(`${host}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          api_key: key,
          event,
          // Customer and system events belong to the business, but they
          // aren't something the owner did - keep them off the owner's
          // person profile so they don't count as the owner being active.
          distinct_id: userId,
          timestamp: at.toISOString(),
          properties: {
            ...props,
            actor,
            feature: EVENTS[event].feature,
            meaningful: EVENTS[event].meaningful && actor === "owner",
            dedupe_key: dedupeKey ?? null,
            $lib: "orbit-server",
            ...(actor === "owner" ? {} : { $process_person_profile: false }),
          },
        }),
      });
    } catch (err) {
      console.warn(`[analytics] PostHog forward failed for ${event}:`, err instanceof Error ? err.message : err);
    }
  };
  try {
    after(send); // after the response, inside the same request lifetime
  } catch {
    void send(); // not inside a request (scripts, tests)
  }
}
