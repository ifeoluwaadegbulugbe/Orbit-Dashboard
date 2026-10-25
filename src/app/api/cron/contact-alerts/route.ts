import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";

/**
 * POST|GET /api/cron/contact-alerts  (Authorization: Bearer <CRON_SECRET>)
 *
 * Emails the Orbit inbox about new messages from the website's contact form
 * (rows in `leads` with source 'contact-form'). Called by a database trigger
 * the moment a message is saved, and every 15 minutes as a backup
 * (migration 027). Reads the messages from the database itself, never from
 * the request, and claims each row before sending so nothing goes out twice.
 */
export const dynamic = "force-dynamic";

const INBOX = process.env.CONTACT_ALERT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "getorbitcrm@gmail.com";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: pending, error } = await supabase
    .from("leads").select("id, name, email, message, created_at")
    .eq("source", "contact-form").is("notified_at", null)
    .order("created_at").limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  const problems: string[] = [];
  for (const lead of pending ?? []) {
    // Claim it first: if the trigger and the backup run overlap, only one sends.
    const { data: claimed } = await supabase
      .from("leads").update({ notified_at: new Date().toISOString() })
      .eq("id", lead.id).is("notified_at", null).select("id");
    if (!claimed?.length) continue;

    const name = (lead.name ?? "").trim() || "Someone";
    const email = (lead.email ?? "").trim();
    const message = (lead.message ?? "").trim() || "(no message)";
    const when = new Date(lead.created_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
    const validReplyTo = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : undefined;

    const res = await sendEmail({
      to: INBOX,
      subject: `New website message from ${name}`.slice(0, 120),
      replyTo: validReplyTo,
      text: `${name} <${email}> wrote on ${when} (Lagos time):\n\n${message}\n\nHit Reply to answer them.`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.5">
<p style="margin:0 0 4px"><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p>
<p style="margin:0 0 16px;color:#666;font-size:13px">Sent from the contact form on getorbitcrm.com, ${esc(when)} (Lagos time)</p>
<div style="white-space:pre-wrap;border-left:3px solid #e8487b;padding:8px 14px;background:#faf7f5">${esc(message)}</div>
<p style="margin:16px 0 0;color:#666;font-size:13px">Hit Reply to answer them directly.</p>
</div>`,
    });
    if (res.ok) {
      sent++;
    } else {
      // Put it back so the next run tries again.
      await supabase.from("leads").update({ notified_at: null }).eq("id", lead.id);
      problems.push(`${lead.id}: ${res.error}`);
    }
  }
  return NextResponse.json({ sent, problems });
}

export const GET = run;
export const POST = run;
