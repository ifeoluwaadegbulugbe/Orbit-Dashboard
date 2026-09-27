import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";
import { notify } from "@/lib/notifications/server";
import { getEffectiveRule, fillTemplate, type MessageRuleRow } from "@/lib/automations/rules";
import { isProServer } from "@/lib/subscription/isPro";

/**
 * Re-engages clients who've gone quiet 30+ days - a real send path for the
 * "Quiet-client follow-ups" automation, which previously had no backend at
 * all. Off by default per user (message_rules) - opt-in.
 *
 * If the client has an email, sends and updates last_contacted - which is
 * also the dedupe mechanism: resetting last_contacted naturally restarts
 * the 30-day quiet window, so no extra tracking column is needed. No email
 * on file -> just notifies the owner (repeats daily like Home's existing
 * follow-up list already does, which is consistent with current behavior).
 *
 * Designed to run weekly. Vercel Cron config (vercel.json):
 *   { "path": "/api/cron/client-followups", "schedule": "0 9 * * 1" }
 */

const QUIET_DAYS = 30;

interface ClientRow {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  last_contacted: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  business_name: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - QUIET_DAYS * 86_400_000).toISOString();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, user_id, name, email, last_contacted")
    .neq("status", "inactive")
    .or(`last_contacted.is.null,last_contacted.lt.${cutoff}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No quiet clients." });
  }

  const rows = clients as ClientRow[];
  const userIds = Array.from(new Set(rows.map((c) => c.user_id)));

  const [{ data: profiles }, { data: ruleRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, business_name, subscription_status, trial_ends_at").in("id", userIds),
    supabase.from("message_rules").select("user_id, trigger_type, enabled, template").in("user_id", userIds).eq("trigger_type", "client_followup"),
  ]);

  const profileMap = new Map<string, ProfileRow>((profiles ?? []).map((p) => [p.id as string, p as ProfileRow]));
  const rulesByUser = new Map<string, MessageRuleRow[]>();
  for (const row of (ruleRows ?? []) as (MessageRuleRow & { user_id: string })[]) {
    const list = rulesByUser.get(row.user_id) ?? [];
    list.push(row);
    rulesByUser.set(row.user_id, list);
  }

  let sent = 0;
  let notified = 0;
  const errors: string[] = [];

  for (const client of rows) {
    const profile = profileMap.get(client.user_id);
    if (!profile || !isProServer(profile)) continue;

    const rule = getEffectiveRule(rulesByUser.get(client.user_id) ?? [], "client_followup");
    if (!rule.enabled) continue;

    const daysQuiet = client.last_contacted
      ? Math.floor((Date.now() - new Date(client.last_contacted).getTime()) / 86_400_000)
      : null;
    const businessName = profile.business_name?.trim() || profile.full_name?.trim() || "your business";

    let emailSent = false;
    if (client.email) {
      const body = rule.template
        ? fillTemplate(rule.template, { client_name: client.name, days_since_contact: String(daysQuiet ?? "") })
        : `Hi ${client.name},\n\nIt's been a while since we last connected! I'd love to have you back at ${businessName} - let me know if you'd like to book something.\n\nHope to see you soon!`;

      const result = await sendEmail({
        to: client.email,
        subject: `We miss you at ${businessName}`,
        html: `<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`,
        text: body,
      });
      if (result.ok) {
        emailSent = true;
        sent++;
        // Resets the 30-day window - this IS the dedupe, not just a side effect.
        await supabase.from("clients").update({ last_contacted: new Date().toISOString() }).eq("id", client.id);
      } else if (!result.skipped) {
        errors.push(`${client.id}: ${result.error}`);
      }
    }

    await notify(supabase, {
      userId: client.user_id,
      type: "reminder_due",
      title: emailSent
        ? `Sent an automatic follow-up to ${client.name}`
        : `${client.name} has gone quiet`,
      body: emailSent
        ? "A check-in email went out on your behalf."
        : `No email on file for ${client.name} - consider a WhatsApp check-in.`,
      actionUrl: `/clients/${client.id}`,
      metadata: { client_id: client.id, email_sent: emailSent },
    });
    notified++;
  }

  return NextResponse.json({ ok: true, sent, notified, considered: rows.length, errors: errors.length ? errors : undefined });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
