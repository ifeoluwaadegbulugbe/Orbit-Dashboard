import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";
import { requirePro } from "@/lib/subscription/server";
import { overLimit, DAY } from "@/lib/rate-limit";

/**
 * Sends an ad-hoc plain-text message (an AI-drafted payment reminder,
 * follow-up, or birthday wish) directly to a client's email - the
 * counterpart to the "Send via WhatsApp" wa.me link for the same drafts,
 * since email already has real server-side sending and WhatsApp doesn't
 * (see src/lib/whatsapp.ts for why that one's tap-to-send only).
 *
 * Requires auth so this can't be used as an open mail relay.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    subject?: string;
    text?: string;
  };
  if (!body.to || !body.text) {
    return NextResponse.json({ error: "Missing recipient or message" }, { status: 400 });
  }

  // Not a free mail relay: Pro only (it sends AI drafts), only to an email
  // address that's on one of this business's own clients, and capped.
  const locked = await requirePro(user.id, user.email, "Emailing drafts");
  if (locked) return locked;
  const to = body.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: "That email address isn't valid." }, { status: 400 });
  const { data: client } = await supabase.from("clients").select("id").eq("user_id", user.id).ilike("email", to.replace(/[%_\\]/g, "\\$&")) /* exact match, case-insensitive: wildcards escaped */.limit(1).maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "You can only email clients saved in Orbit. Add their email to the client first." }, { status: 400 });
  }
  if (await overLimit([[`send-email:user:${user.id}`, { max: 50, windowMs: DAY }]])) {
    return NextResponse.json({ error: "You've sent a lot of emails today. Try again tomorrow, or use WhatsApp." }, { status: 429 });
  }
  body.text = body.text.slice(0, 5000);

  const result = await sendEmail({
    to,
    subject: body.subject?.trim() || "A message from your service provider",
    html: `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; white-space: pre-wrap;">${escapeHtml(body.text)}</p>`,
    text: body.text,
  });

  if (!result.ok && !result.skipped) {
    return NextResponse.json({ error: result.error ?? "Could not send email" }, { status: 502 });
  }
  if (result.skipped) {
    return NextResponse.json({ error: "Email isn't configured yet (RESEND_API_KEY missing)" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>");
}
