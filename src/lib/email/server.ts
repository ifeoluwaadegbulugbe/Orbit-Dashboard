/**
 * Outbound email helper. Uses Resend by default (https://resend.com).
 *
 * Configure with two env vars:
 *   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
 *   RESEND_FROM_EMAIL="Orbit <reminders@yourdomain.com>"
 *
 * If RESEND_API_KEY is missing, sendEmail() returns { skipped: true } so the
 * cron route can run safely in development without crashing.
 */

import "server-only";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Orbit <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message ?? `Resend ${res.status}` };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
