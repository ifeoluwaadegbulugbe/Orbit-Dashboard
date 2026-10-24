/**
 * Phone push notifications (Web Push). Sends to every device an owner has
 * switched notifications on for. No paid service: the browser vendors
 * (Google, Apple, Mozilla) deliver them, authorised by our VAPID key pair.
 *
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  - shared with the browser when subscribing
 *   VAPID_PRIVATE_KEY             - server only
 *   VAPID_SUBJECT                 - "mailto:you@..." so push services can reach us
 *
 * Without the keys this is a no-op. Never throws.
 */

import "server-only";
import webpush, { WebPushError } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PushMessage {
  title: string;
  body?: string | null;
  /** Page to open when tapped (same-site path). */
  url?: string | null;
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string;
}

export function pushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

interface SubRow { id: string; endpoint: string; p256dh: string; auth: string }

export async function sendPushToUser(supabase: SupabaseClient, userId: string, msg: PushMessage): Promise<{ sent: number }> {
  if (!pushConfigured()) return { sent: 0 };
  let sent = 0;
  try {
    const { data, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    if (error || !data?.length) return { sent: 0 };

    const payload = JSON.stringify({
      title: msg.title,
      body: msg.body ?? "",
      url: msg.url && /^\/(?!\/)/.test(msg.url) ? msg.url : "/home", // same-site paths only ("//x" is another site)
      tag: msg.tag,
    });
    const vapidDetails = {
      subject: process.env.VAPID_SUBJECT || "mailto:hello@getorbitcrm.com",
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      privateKey: process.env.VAPID_PRIVATE_KEY!,
    };

    await Promise.all((data as SubRow[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { vapidDetails, TTL: 60 * 60, timeout: 5000 },
        );
        sent++;
        await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (err) {
        // 404/410: the phone unsubscribed, uninstalled, or signed out - forget it.
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.warn("[push] send failed:", err instanceof Error ? err.message : err);
        }
      }
    }));
  } catch (err) {
    console.warn("[push] unexpected error:", err);
  }
  return { sent };
}
