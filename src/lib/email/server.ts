/**
 * Outbound email helper. Two transports, picked by which env vars are set:
 *
 * 1. SMTP (preferred, free) — e.g. your Gmail account with an App Password.
 *      SMTP_USER=you@gmail.com
 *      SMTP_PASS=abcdefghijklmnop          (16-char Google App Password)
 *      SMTP_HOST=smtp.gmail.com            (optional, this is the default)
 *      SMTP_PORT=465                       (optional, this is the default)
 *      EMAIL_FROM="Orbit <you@gmail.com>"  (optional, defaults to SMTP_USER)
 *    Works with any SMTP provider (Gmail, Brevo, Zoho, …) without owning a domain.
 *
 * 2. Resend (https://resend.com)
 *      RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
 *      RESEND_FROM_EMAIL="Orbit <reminders@yourdomain.com>"
 *    NOTE: without a domain verified in Resend, the default onboarding@resend.dev
 *    sender can ONLY deliver to the Resend account owner's own address — every
 *    other recipient is rejected with a 403.
 *
 * If neither is configured, sendEmail() returns { skipped: true } so cron
 * routes can run safely in development without crashing.
 */

import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Extra headers, e.g. List-Unsubscribe for lifecycle/marketing mail. */
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
  /** The address itself was rejected (doesn't exist, mailbox disabled...) - retrying won't help. */
  permanent?: boolean;
}

/** SMTP 5xx recipient errors and their usual wording = a dead address. */
function isPermanentRecipientError(message: string, code?: number): boolean {
  if (code && code >= 550 && code <= 554) return true;
  return /\b55[0-4]\b|user unknown|no such user|does not exist|mailbox (unavailable|disabled|not found)|invalid (recipient|address)|recipient address rejected/i.test(message);
}

// Reused across invocations of a warm serverless instance.
let smtpTransport: Transporter | null = null;

function getSmtpTransport(): Transporter | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, ""); // Google shows app passwords with spaces
  if (!user || !pass) return null;
  if (!smtpTransport) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port,
      secure: port === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
      auth: { user, pass },
    });
  }
  return smtpTransport;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const smtp = getSmtpTransport();
  if (smtp) return sendViaSmtp(smtp, params);
  if (process.env.RESEND_API_KEY) return sendViaResend(process.env.RESEND_API_KEY, params);
  return { ok: false, skipped: true, error: "No email provider configured (set SMTP_USER/SMTP_PASS or RESEND_API_KEY)" };
}

async function sendViaSmtp(
  transport: Transporter,
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM ?? `Orbit <${process.env.SMTP_USER}>`;
  try {
    const info = await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: params.headers,
    });
    // Some servers accept the message but list the address as rejected.
    if (info.rejected?.length) {
      return { ok: false, error: `Rejected: ${info.rejected.join(", ")}`, permanent: true };
    }
    return { ok: true, id: info.messageId };
  } catch (err) {
    const e = err as { message?: string; responseCode?: number };
    const message = e?.message ?? String(err);
    return { ok: false, error: message, permanent: isPermanentRecipientError(message, e?.responseCode) };
  }
}

async function sendViaResend(apiKey: string, params: SendEmailParams): Promise<SendEmailResult> {
  const from = process.env.RESEND_FROM_EMAIL ?? "Orbit <onboarding@resend.dev>";
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
        headers: params.headers,
      }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      const message = json.message ?? `Resend ${res.status}`;
      return { ok: false, error: message, permanent: res.status === 422 && isPermanentRecipientError(message) };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
