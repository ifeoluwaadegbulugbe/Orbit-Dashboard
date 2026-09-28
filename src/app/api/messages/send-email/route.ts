import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";

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

  const result = await sendEmail({
    to: body.to,
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
