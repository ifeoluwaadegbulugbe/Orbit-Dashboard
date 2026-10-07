/**
 * The lifecycle engine - runs every 15 minutes from /api/cron/lifecycle.
 *
 * For every owner:
 *   1. Build a snapshot of what they've ACTUALLY done (from existing tables).
 *   2. Save activation progress, lifecycle stage and next best action.
 *   3. Mark earlier emails "converted" if the owner has since done what the
 *      email asked (email -> product action attribution).
 *   4. Pick at most ONE email: highest-priority campaign that is eligible
 *      right now, not already sent, allowed by preferences, suppression and
 *      frequency caps.
 *   5. Claim a unique idempotency key BEFORE sending, so overlapping runs or
 *      re-processed events can never send the same email twice.
 *
 * Sending is OFF until LIFECYCLE_EMAILS_ENABLED=true - until then a run is a
 * dry run that reports what it would send.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/server";
import { appUrl } from "@/lib/app-url";
import { signId } from "@/lib/signed-links";
import { computeSubscriptionState } from "@/lib/subscription/isPro";
import {
  activation, firstValueAchieved, lifecycleStage, nextBestAction, daysSince, type UserFacts,
} from "./activation";
import { CAMPAIGNS, type Campaign, type CampaignContext } from "./campaigns";
import { renderLifecycleEmail } from "./render";

/** Frequency caps for lifecycle/marketing email (transactional email is never counted). */
const MAX_PER_DAY = Number(process.env.LIFECYCLE_MAX_PER_DAY ?? 1);
const MAX_PER_WEEK = Number(process.env.LIFECYCLE_MAX_PER_WEEK ?? 3);
/** Safety net for the whole run - keeps Gmail-type SMTP senders well under their daily limit. */
const MAX_SENDS_PER_RUN = Number(process.env.LIFECYCLE_MAX_PER_RUN ?? 40);
const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MIN = 30;

const DAY = 86_400_000;

interface ProfileRow {
  id: string; email: string | null; full_name: string | null; business_name: string | null;
  subscription_status: string | null; trial_ends_at: string | null; created_at: string;
  last_active_at: string | null; booking_link: { slug?: string; services?: unknown[] } | null;
}
interface PaymentRow { user_id: string; status: string; date: string; created_at: string }
interface PrefRow { user_id: string; tips: boolean; product_updates: boolean; promotions: boolean; unsubscribed_at: string | null }
interface SentRow { id: string; user_id: string; campaign: string; idempotency_key: string; status: string; sent_at: string | null; converted_at: string | null; attempts: number; next_attempt_at: string | null }

export interface RunReport {
  dryRun: boolean;
  users: number;
  sent: { user: string; campaign: string }[];
  wouldSend: { user: string; campaign: string }[];
  skipped: Record<string, number>;
  failed: { user: string; campaign: string; error: string }[];
  conversions: number;
}

export async function runLifecycle(supabase: SupabaseClient, now = new Date()): Promise<RunReport> {
  const dryRun = process.env.LIFECYCLE_EMAILS_ENABLED !== "true";
  const report: RunReport = { dryRun, users: 0, sent: [], wouldSend: [], skipped: {}, failed: [], conversions: 0 };
  const skip = (why: string) => { report.skipped[why] = (report.skipped[why] ?? 0) + 1; };
  const nowMs = now.getTime();
  const base = appUrl();

  // ── Bulk-load everything once (cheap at Orbit's size; move to SQL views when it grows)
  const [profilesQ, clientsQ, bookingsQ, paymentsQ, remindersQ, prefsQ, suppQ, sentQ, checkoutQ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, business_name, subscription_status, trial_ends_at, created_at, last_active_at, booking_link"),
    supabase.from("clients").select("user_id"),
    supabase.from("bookings").select("user_id"),
    supabase.from("payments").select("user_id, status, date, created_at"),
    supabase.from("reminders").select("user_id"),
    supabase.from("email_preferences").select("user_id, tips, product_updates, promotions, unsubscribed_at"),
    supabase.from("email_suppressions").select("email"),
    supabase.from("lifecycle_emails").select("id, user_id, campaign, idempotency_key, status, sent_at, converted_at, attempts, next_attempt_at"),
    supabase.from("user_product_events").select("id, user_id, created_at").eq("event", "checkout_started")
      .gte("created_at", new Date(nowMs - 3 * DAY).toISOString()).order("created_at", { ascending: false }),
  ]);
  const setupError = [profilesQ, prefsQ, suppQ, sentQ, checkoutQ].find((q) => q.error)?.error;
  if (setupError) throw new Error(`Lifecycle tables unavailable (run migration 018?): ${setupError.message}`);

  const countBy = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const clients = countBy(clientsQ.data as { user_id: string }[] | null);
  const bookings = countBy(bookingsQ.data as { user_id: string }[] | null);
  const reminders = countBy(remindersQ.data as { user_id: string }[] | null);
  const paymentsByUser = new Map<string, PaymentRow[]>();
  for (const p of (paymentsQ.data ?? []) as PaymentRow[]) {
    paymentsByUser.set(p.user_id, [...(paymentsByUser.get(p.user_id) ?? []), p]);
  }
  const prefs = new Map(((prefsQ.data ?? []) as PrefRow[]).map((p) => [p.user_id, p]));
  const suppressed = new Set(((suppQ.data ?? []) as { email: string }[]).map((s) => s.email.toLowerCase()));
  const sentByUser = new Map<string, SentRow[]>();
  for (const r of (sentQ.data ?? []) as SentRow[]) sentByUser.set(r.user_id, [...(sentByUser.get(r.user_id) ?? []), r]);
  const lastCheckout = new Map<string, { id: number; created_at: string }>();
  for (const e of (checkoutQ.data ?? []) as { id: number; user_id: string; created_at: string }[]) {
    if (!lastCheckout.has(e.user_id)) lastCheckout.set(e.user_id, e);
  }

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  report.users = profiles.length;
  let sendsThisRun = 0;

  for (const p of profiles) {
    const payments = paymentsByUser.get(p.id) ?? [];
    const unpaid = payments.filter((x) => !["paid", "refunded", "failed"].includes(x.status));
    const facts: UserFacts = {
      signedUpAt: p.created_at,
      lastActiveAt: p.last_active_at,
      isPro: computeSubscriptionState(p, false).isPro,
      hasBusinessName: !!p.business_name?.trim(),
      serviceCount: Array.isArray(p.booking_link?.services) ? p.booking_link!.services!.length : 0,
      bookingLinkLive: !!p.booking_link?.slug,
      clientCount: clients.get(p.id) ?? 0,
      bookingCount: bookings.get(p.id) ?? 0,
      invoiceCount: payments.length,
      paidInvoiceCount: payments.filter((x) => x.status === "paid").length,
      reminderCount: reminders.get(p.id) ?? 0,
    };
    const act = activation(facts);
    const history = sentByUser.get(p.id) ?? [];

    // ── 2. Lifecycle state ────────────────────────────────────────────────
    const { data: existing } = await supabase.from("user_lifecycle")
      .select("activated_at, first_value_at, activation_started_at").eq("user_id", p.id).maybeSingle();
    await supabase.from("user_lifecycle").upsert({
      user_id: p.id,
      stage: lifecycleStage(facts, nowMs),
      activation_steps: act.steps,
      activation_pct: act.pct,
      activation_started_at: existing?.activation_started_at ?? (act.doneCount > 0 ? now.toISOString() : null),
      activated_at: existing?.activated_at ?? (act.activated ? now.toISOString() : null),
      first_value_at: existing?.first_value_at ?? (firstValueAchieved(facts) ? now.toISOString() : null),
      next_best_action: nextBestAction(facts, nowMs),
      updated_at: now.toISOString(),
    });

    // ── 3. Attribution: did they do what an earlier email asked? ────────────
    for (const row of history) {
      if (row.status !== "sent" || row.converted_at) continue;
      const camp = CAMPAIGNS.find((c) => c.id === row.campaign);
      if (camp?.goal(facts)) {
        await supabase.from("lifecycle_emails").update({ converted_at: now.toISOString() }).eq("id", row.id);
        report.conversions++;
      }
    }

    // ── 4. Pick at most one email ───────────────────────────────────────────
    const email = p.email?.trim().toLowerCase();
    if (!email) { skip("no_email"); continue; }
    if (suppressed.has(email)) { skip("suppressed"); continue; }
    const pref = prefs.get(p.id);
    if (pref?.unsubscribed_at) { skip("unsubscribed"); continue; }

    const sentTimes = history.filter((r) => r.status === "sent" && r.sent_at).map((r) => new Date(r.sent_at!).getTime());
    if (sentTimes.filter((t) => nowMs - t < DAY).length >= MAX_PER_DAY) { skip("daily_cap"); continue; }
    if (sentTimes.filter((t) => nowMs - t < 7 * DAY).length >= MAX_PER_WEEK) { skip("weekly_cap"); continue; }

    const daysSentAgo = new Map<string, number>();
    for (const r of history) {
      if (r.status !== "sent" || !r.sent_at) continue;
      const d = daysSince(r.sent_at, nowMs) ?? 0;
      if (!daysSentAgo.has(r.campaign) || d < daysSentAgo.get(r.campaign)!) daysSentAgo.set(r.campaign, d);
    }
    const checkout = lastCheckout.get(p.id);
    const ctx: CampaignContext = {
      facts,
      firstName: p.full_name?.trim().split(/\s+/)[0] || null,
      businessName: p.business_name?.trim() || null,
      daysSinceSignup: daysSince(p.created_at, nowMs) ?? 0,
      oldestUnpaidInvoiceDays: unpaid.length ? Math.max(...unpaid.map((x) => daysSince(x.created_at, nowMs) ?? 0)) : null,
      lastCheckout: checkout ? { id: checkout.id, hoursAgo: (nowMs - new Date(checkout.created_at).getTime()) / 3_600_000 } : null,
      sent: daysSentAgo,
      url: (path) => `${base}${path}`,
    };

    const byKey = new Map(history.map((r) => [r.idempotency_key, r]));
    const candidates = CAMPAIGNS
      .filter((c) => (pref ? pref[c.category] !== false : true))
      .filter((c) => {
        const prior = byKey.get(c.key(p.id, ctx));
        if (!prior) return true;
        // Only a failed send that's due for a retry may go again.
        return prior.status === "failed" && prior.attempts < MAX_ATTEMPTS
          && (!prior.next_attempt_at || new Date(prior.next_attempt_at).getTime() <= nowMs);
      })
      .filter((c) => c.eligible(ctx))
      .sort((a, b) => b.priority - a.priority);
    const campaign = candidates[0];
    if (!campaign) { skip("nothing_eligible"); continue; }

    if (dryRun) { report.wouldSend.push({ user: p.id, campaign: campaign.id }); continue; }
    if (sendsThisRun >= MAX_SENDS_PER_RUN) { skip("run_limit"); continue; }

    const result = await deliver(supabase, p.id, email, campaign, ctx, byKey.get(campaign.key(p.id, ctx)), base, now);
    if (result === "sent") { sendsThisRun++; report.sent.push({ user: p.id, campaign: campaign.id }); }
    else if (result === "claimed_elsewhere") skip("claimed_elsewhere");
    else report.failed.push({ user: p.id, campaign: campaign.id, error: result.error });
  }

  return report;
}

async function deliver(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  campaign: Campaign,
  ctx: CampaignContext,
  prior: SentRow | undefined,
  base: string,
  now: Date,
): Promise<"sent" | "claimed_elsewhere" | { error: string }> {
  const key = campaign.key(userId, ctx);
  const subject = campaign.subject(ctx);

  // ── Claim the idempotency key. A new row (or a due retry) wins; anything
  // else means another run already has it.
  let rowId: string;
  let attempts: number;
  if (!prior) {
    const { data, error } = await supabase.from("lifecycle_emails").insert({
      user_id: userId, campaign: campaign.id, category: campaign.category,
      idempotency_key: key, to_email: email, subject, status: "sending", attempts: 1,
    }).select("id").single();
    if (error) return error.code === "23505" ? "claimed_elsewhere" : { error: error.message };
    rowId = data.id as string;
    attempts = 1;
  } else {
    const { data } = await supabase.from("lifecycle_emails")
      .update({ status: "sending", attempts: prior.attempts + 1 })
      .eq("id", prior.id).eq("status", "failed").select("id");
    if (!data?.length) return "claimed_elsewhere";
    rowId = prior.id;
    attempts = prior.attempts + 1;
  }

  // Every link goes through /e/<rowId> so clicks are recorded.
  const tracked = (url: string) => {
    const path = url.startsWith(base) ? url.slice(base.length) || "/" : url;
    return `${base}/e/${rowId}?to=${encodeURIComponent(path)}`;
  };
  const content = campaign.content(ctx);
  content.cta = { ...content.cta, url: tracked(content.cta.url) };
  if (content.secondary) content.secondary = { ...content.secondary, url: tracked(content.secondary.url) };

  const unsubQuery = `u=${userId}&t=${signId("unsub", userId)}`;
  // Footer link -> confirmation page; header -> the POST endpoint mail apps call for one-click.
  const unsubscribeUrl = `${base}/email/unsubscribe?${unsubQuery}`;
  const oneClickUrl = `${base}/api/email/unsubscribe?${unsubQuery}`;
  const { html, text } = renderLifecycleEmail(content, {
    unsubscribeUrl,
    preferencesUrl: `${base}/profile#email-preferences`,
    appUrl: base,
  });

  const result = await sendEmail({
    to: email,
    subject,
    html,
    text,
    headers: {
      // RFC 8058 one-click unsubscribe, required by Gmail/Yahoo for this kind of mail.
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (result.ok) {
    await supabase.from("lifecycle_emails")
      .update({ status: "sent", sent_at: now.toISOString(), last_error: null, next_attempt_at: null })
      .eq("id", rowId);
    return "sent";
  }

  const error = result.error ?? (result.skipped ? "No email provider configured" : "Send failed");
  if (result.permanent) {
    // Dead address: stop all lifecycle mail to it.
    await supabase.from("email_suppressions").upsert({ email, reason: "bounce", detail: error.slice(0, 300) });
    await supabase.from("lifecycle_emails").update({ status: "skipped", last_error: error.slice(0, 500) }).eq("id", rowId);
  } else {
    const giveUp = attempts >= MAX_ATTEMPTS;
    await supabase.from("lifecycle_emails").update({
      status: "failed",
      last_error: error.slice(0, 500),
      next_attempt_at: giveUp ? null : new Date(now.getTime() + RETRY_AFTER_MIN * 60_000 * attempts).toISOString(),
    }).eq("id", rowId);
  }
  return { error };
}
