import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";
import { notify } from "@/lib/notifications/server";
import { getEffectiveRule, fillTemplate, type MessageRuleRow } from "@/lib/automations/rules";
import { isProServer } from "@/lib/subscription/isPro";
import { formatMoney } from "@/lib/countries";

/**
 * Automatically chases unpaid invoices - a real send path for the
 * "Payment reminders" automation, which previously had no backend at all
 * (see orbit-overhaul.md discussion + src/app/(dashboard)/automations/page.tsx).
 * Off by default per user (message_rules) - opt-in, since this is a brand
 * new automatic email to a real client, not something already happening.
 *
 * Sends at most twice per invoice (day 3, day 7 overdue), tracked via
 * payments.reminder_stage. If the client has no email on file, skips the
 * send but still notifies the owner to chase manually - the AI "Draft
 * reminder" button on that invoice is right there for that.
 *
 * Designed to run once daily. Vercel Cron config (vercel.json):
 *   { "path": "/api/cron/payment-reminders", "schedule": "0 9 * * *" }
 */

const STAGE_THRESHOLDS = [3, 7]; // days overdue required to advance to stage 1, then 2

interface PaymentRow {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  amount: number;
  date: string;
  status: string;
  reminder_stage: number;
}

interface ClientRow {
  id: string;
  email: string | null;
}

interface ProfileRow {
  country_code?: string | null;
  id: string;
  email: string | null;
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
  const today = new Date().toISOString().slice(0, 10);

  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, user_id, client_id, client_name, amount, date, status, reminder_stage")
    .in("status", ["pending", "overdue"])
    .lt("date", today)
    .lt("reminder_stage", STAGE_THRESHOLDS.length);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!payments || payments.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "Nothing overdue enough yet." });
  }

  const rows = payments as PaymentRow[];
  const dueNow = rows.filter((p) => {
    const daysOverdue = Math.floor((Date.now() - new Date(p.date).getTime()) / 86_400_000);
    return daysOverdue >= STAGE_THRESHOLDS[p.reminder_stage];
  });

  if (dueNow.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "Nothing crossed a reminder threshold." });
  }

  const userIds = Array.from(new Set(dueNow.map((p) => p.user_id)));
  const clientIds = Array.from(new Set(dueNow.map((p) => p.client_id)));

  const [{ data: profiles }, { data: clients }, { data: ruleRows }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, business_name, subscription_status, trial_ends_at, country_code").in("id", userIds),
    supabase.from("clients").select("id, email").in("id", clientIds),
    supabase.from("message_rules").select("user_id, trigger_type, enabled, template").in("user_id", userIds).eq("trigger_type", "payment_reminder"),
  ]);

  const profileMap = new Map<string, ProfileRow>((profiles ?? []).map((p) => [p.id as string, p as ProfileRow]));
  const clientMap = new Map<string, ClientRow>((clients ?? []).map((c) => [c.id as string, c as ClientRow]));
  const rulesByUser = new Map<string, MessageRuleRow[]>();
  for (const row of (ruleRows ?? []) as (MessageRuleRow & { user_id: string })[]) {
    const list = rulesByUser.get(row.user_id) ?? [];
    list.push(row);
    rulesByUser.set(row.user_id, list);
  }

  let sent = 0;
  let notified = 0;
  const errors: string[] = [];

  for (const payment of dueNow) {
    const profile = profileMap.get(payment.user_id);
    if (!profile || !isProServer(profile)) continue;

    const rule = getEffectiveRule(rulesByUser.get(payment.user_id) ?? [], "payment_reminder");
    if (!rule.enabled) continue;

    const client = clientMap.get(payment.client_id);
    const daysOverdue = Math.floor((Date.now() - new Date(payment.date).getTime()) / 86_400_000);
    const nextStage = payment.reminder_stage + 1;
    // Orbit is multi-currency and payments don't carry a currency code of
    // their own (it's a soft, business-level preference) - a plain number
    // avoids asserting the wrong currency symbol server-side.
    const amountDisplay = formatMoney(payment.amount, profile.country_code);
    const businessName = profile.business_name?.trim() || profile.full_name?.trim() || "your business";

    let emailSent = false;
    if (client?.email) {
      const body = rule.template
        ? fillTemplate(rule.template, {
            client_name: payment.client_name,
            amount: amountDisplay,
            days_overdue: String(daysOverdue),
          })
        : `Hi ${payment.client_name},\n\nJust a friendly reminder that your invoice with ${businessName} for ${amountDisplay} is now ${daysOverdue} days overdue. If you've already paid, please disregard this.\n\nThanks!`;

      const result = await sendEmail({
        to: client.email,
        subject: `Payment reminder from ${businessName}`,
        html: `<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`,
        text: body,
      });
      if (result.ok) {
        emailSent = true;
        sent++;
      } else if (!result.skipped) {
        errors.push(`${payment.id}: ${result.error}`);
      }
    }

    await supabase
      .from("payments")
      .update({ reminder_stage: nextStage, last_reminder_sent_at: new Date().toISOString() })
      .eq("id", payment.id);

    await notify(supabase, {
      userId: payment.user_id,
      type: "invoice_overdue",
      title: emailSent
        ? `Sent an automatic payment reminder to ${payment.client_name}`
        : `${payment.client_name}'s invoice is ${daysOverdue} days overdue`,
      body: emailSent
        ? `${amountDisplay}, ${daysOverdue} days overdue.`
        : `No email on file for ${payment.client_name} - consider drafting a WhatsApp message.`,
      actionUrl: `/payments/${payment.id}`,
      metadata: { payment_id: payment.id, days_overdue: daysOverdue, email_sent: emailSent },
    });
    notified++;
  }

  return NextResponse.json({ ok: true, sent, notified, considered: dueNow.length, errors: errors.length ? errors : undefined });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
