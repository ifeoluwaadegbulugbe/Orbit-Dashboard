"use client";

/**
 * Browser analytics. Two jobs only:
 *
 *  - PostHog for page views and identity (who is using Orbit, on what
 *    device). Autocapture and session replay are OFF: clicks on client
 *    names or invoice text would otherwise leave Orbit.
 *  - `track()` for product events, which go to /api/analytics/track - the
 *    server records them once and forwards them to PostHog, so there is a
 *    single source of truth and no double counting between the two.
 *
 * Every call is fire-and-forget and swallows its own errors: analytics can
 * never block or break the action being tracked.
 */

import posthog from "posthog-js";
import type { EventName } from "./catalog";

let started = false;

function enabled(): boolean {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return false;
  // Keep local development out of production metrics unless asked for.
  return process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_POSTHOG_DEV === "true";
}

/** Idempotent - safe to call from effects that run twice. */
export function initAnalytics(): void {
  if (started || !enabled()) return;
  started = true;
  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      // Same-origin proxy (next.config rewrites) so ad blockers don't drop events.
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com",
      defaults: "2025-05-24",
      capture_pageview: "history_change", // App Router navigations count once each
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      person_profiles: "identified_only", // anonymous visitors don't create people
      // Signed links (client page, reviews, unsubscribe, password reset)
      // carry secrets in the URL - strip them before anything leaves.
      before_send: (event) => {
        if (!event) return event;
        for (const key of ["$current_url", "$referrer", "$prev_pageview_pathname"]) {
          const v = event.properties?.[key];
          if (typeof v === "string") event.properties[key] = stripSecrets(v);
        }
        return event;
      },
    });
  } catch (err) {
    started = false;
    console.warn("[analytics] PostHog init failed:", err);
  }
}

const SECRET_PARAMS = ["t", "token", "token_hash", "code", "access_token", "refresh_token"];

function stripSecrets(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    for (const p of SECRET_PARAMS) u.searchParams.delete(p);
    u.hash = "";
    return u.toString();
  } catch {
    return url.split("?")[0];
  }
}

let identifiedAs: string | null = null;

/**
 * Link this browser to the signed-in owner. Calling it again for the same
 * user is a no-op, so repeated logins and re-renders don't create duplicate
 * identities. Anonymous page views before login are merged into the user.
 */
export function identifyUser(user: { id: string; createdAt?: string | null; tier?: string | null; internal?: boolean }): void {
  if (!enabled() || identifiedAs === user.id) return;
  try {
    initAnalytics();
    if (posthog.get_distinct_id() !== user.id) {
      posthog.identify(user.id, { subscription_tier: user.tier ?? null, is_internal: !!user.internal }, { signed_up_at: user.createdAt ?? null });
    } else {
      posthog.setPersonProperties({ subscription_tier: user.tier ?? null, is_internal: !!user.internal });
    }
    identifiedAs = user.id;
  } catch (err) {
    console.warn("[analytics] identify failed:", err);
  }
}

/** On sign-out: the next person on this browser starts as a fresh anonymous visitor. */
export function resetAnalytics(): void {
  identifiedAs = null;
  sentKeys.clear();
  if (!started) return;
  try {
    posthog.reset();
  } catch {
    // ignore
  }
}

/** Keys already sent from this page load - stops re-renders and remounts from re-sending. */
const sentKeys = new Set<string>();

/**
 * Record a product event for the signed-in owner. Call it only after the
 * action has actually succeeded. `dedupeKey` (e.g. "client_created:<id>")
 * makes the server count the action once even if this fires twice.
 */
export function track(event: EventName, opts: { dedupeKey?: string; props?: Record<string, string | number | boolean | null> } = {}): void {
  if (typeof window === "undefined") return;
  if (opts.dedupeKey) {
    if (sentKeys.has(opts.dedupeKey)) return;
    sentKeys.add(opts.dedupeKey);
  }
  try {
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, dedupeKey: opts.dedupeKey, props: opts.props }),
      keepalive: true, // survives a navigation right after the action
    }).catch(() => {});
  } catch {
    // never surface analytics errors
  }
}

/** "Viewed X" style events: at most once per key per browser session. */
export function trackOncePerSession(event: EventName, key: string, props?: Record<string, string | number | boolean | null>): void {
  try {
    const k = `orbit-tracked:${event}:${key}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  } catch {
    // storage blocked - fall back to the in-memory guard in track()
  }
  track(event, { dedupeKey: `${event}:${key}:${new Date().toISOString().slice(0, 10)}`, props });
}
