/**
 * Automatic review requests: about 2 hours after an appointment ends, ask
 * the client to rate it (email + WhatsApp when connected). Runs from the
 * appointment-reminders cron tick. Each booking is asked at most once
 * (bookings.review_requested_at), and only for owners who switched on the
 * "Review requests" automation.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/server";
import { reviewUrl } from "@/lib/signed-links";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-cloud";
import { getEffectiveRule, type MessageRuleRow } from "@/lib/automations/rules";
import { zonedTimeToUtcMs, DEFAULT_TIMEZONE } from "@/lib/time/zonedTime";

const DELAY_AFTER_END_MS = 2 * 60 * 60 * 1000;
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000; // don't ask about old appointments
const DEFAULT_DURATION_MIN = 60;

interface Row {
  id: string; user_id: string; client_id: string; client_name: string;
  date: string; time: string | null; title: string; duration_minutes: number | null;
}

export async function sendDueReviewRequests(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("bookings")
    .select("id, user_id, client_id, client_name, date, time, title, duration_minutes")
    .in("date", [yesterday, today])
    .in("status", ["confirmed", "completed"])
    .is("review_requested_at", null);
  // Column missing = migration 017 not run yet; quietly do nothing.
  if (error || !data?.length) return { sent: 0, errors: error && !/review_requested_at/.test(error.message) ? [error.message] : [] };

  const bookings = data as Row[];
  const userIds = [...new Set(bookings.map((b) => b.user_id))];
  const [{ data: profiles }, { data: rules }] = await Promise.all([
    supabase.from("profiles").select("id, business_name, full_name, timezone").in("id", userIds),
    supabase.from("message_rules").select("user_id, trigger_type, enabled, template").in("user_id", userIds).eq("trigger_type", "review_request"),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const rulesByUser = new Map<string, MessageRuleRow[]>();
  for (const r of (rules ?? []) as (MessageRuleRow & { user_id: string })[]) {
    rulesByUser.set(r.user_id, [...(rulesByUser.get(r.user_id) ?? []), r]);
  }

  const due = bookings.filter((b) => {
    if (!getEffectiveRule(rulesByUser.get(b.user_id) ?? [], "review_request").enabled) return false;
    const tz = (profileById.get(b.user_id)?.timezone as string | null) || DEFAULT_TIMEZONE;
    const start = zonedTimeToUtcMs(b.date, b.time ?? "12:00", tz);
    if (!start) return false;
    const askAt = start + (b.duration_minutes || DEFAULT_DURATION_MIN) * 60_000 + DELAY_AFTER_END_MS;
    return now.getTime() >= askAt && now.getTime() - askAt < GIVE_UP_AFTER_MS;
  });
  if (!due.length) return { sent: 0, errors };

  const { data: clients } = await supabase
    .from("clients")
    .select("id, email, phone, whatsapp_number")
    .in("id", [...new Set(due.map((b) => b.client_id))]);
  const clientById = new Map((clients ?? []).map((c) => [c.id as string, c]));

  let sent = 0;
  for (const b of due) {
    // Claim the booking first so overlapping cron ticks can't double-send.
    const { data: claimed } = await supabase
      .from("bookings")
      .update({ review_requested_at: now.toISOString() })
      .eq("id", b.id)
      .is("review_requested_at", null)
      .select("id");
    if (!claimed?.length) continue;

    const profile = profileById.get(b.user_id);
    const business = (profile?.business_name as string) || (profile?.full_name as string) || "us";
    const client = clientById.get(b.client_id);
    const firstName = b.client_name.split(" ")[0];
    const link = reviewUrl(b.id);

    if (client?.email) {
      const r = await sendEmail({
        to: client.email as string,
        subject: `How was your ${b.title} with ${business}?`,
        html: reviewEmailHtml(firstName, business, b.title, link),
        text: `Hi ${firstName},\n\nThank you for visiting ${business}! How was your ${b.title}?\n\nLeave a quick review: ${link}\n\nIt takes 30 seconds and really helps.`,
      });
      if (r.ok) sent++;
      else if (!r.skipped) errors.push(`review email ${b.id}: ${r.error}`);
    }
    const wa = await sendWhatsAppTemplate(
      (client?.whatsapp_number as string) || (client?.phone as string),
      "orbit_review_request",
      [firstName, business, b.title, link],
    );
    if (wa.ok) sent++;
    else if (!wa.skipped) errors.push(`review whatsapp ${b.id}: ${wa.error}`);
  }
  return { sent, errors };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function reviewEmailHtml(firstName: string, business: string, service: string, link: string): string {
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1A1A1A;background:#F2F1EF;">
  <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #E5E3DF;text-align:center;">
    <div style="font-size:30px;letter-spacing:4px;color:#F59E0B;margin-bottom:8px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
    <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">How was your ${esc(service)}, ${esc(firstName)}?</h1>
    <p style="font-size:15px;color:#3D3D3D;margin:0 0 24px;">Thank you for visiting ${esc(business)}. A quick rating helps them and other clients.</p>
    <a href="${esc(link)}" style="display:inline-block;background:#E8557A;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 28px;border-radius:999px;">Leave a review</a>
    <p style="font-size:12px;color:#9A9893;margin:20px 0 0;">Takes about 30 seconds.</p>
  </div>
  <p style="font-size:12px;color:#9A9893;text-align:center;margin-top:16px;">Sent via Orbit on behalf of ${esc(business)}</p>
</body></html>`;
}
