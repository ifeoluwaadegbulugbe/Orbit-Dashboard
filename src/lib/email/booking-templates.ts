/**
 * Email + WhatsApp message templates the booking confirm/decline endpoint
 * uses to talk to the client. Plain strings - no React components, no MDX -
 * so they render reliably in every email client.
 */

import "server-only";

export interface BookingMessageParams {
  /** Client's name as the business owner has it stored. */
  clientName: string;
  /** Visible business name (defaults to owner's full name if unset). */
  businessName: string;
  /** The booked service / title. */
  service: string;
  /** ISO date "2026-05-21" - we format for display. */
  date: string;
  /** "HH:MM" 24-hour time. */
  time: string;
  /** Owner's email so replies route to them. */
  ownerEmail?: string;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function formatDate(date: string): string {
  // "2026-05-21" -> "Thursday, 21 May"
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(time: string): string {
  // "14:30" -> "2:30pm"
  const [h, m] = time.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? "pm" : "am";
  const hr12 = h % 12 === 0 ? 12 : h % 12;
  return `${hr12}:${(m ?? 0).toString().padStart(2, "0")}${period}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Confirmation email ────────────────────────────────────────────────────

export function buildConfirmEmail(p: BookingMessageParams): {
  subject: string;
  html: string;
  text: string;
} {
  const dateLine = formatDate(p.date);
  const timeLine = formatTime(p.time);

  const subject = `Your booking with ${p.businessName} is confirmed`;
  const html = `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A1A1A; background: #F2F1EF;">
  <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #E5E3DF;">
    <div style="font-size: 12px; font-weight: 700; color: #22C55E; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Booking confirmed</div>
    <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">You're all set, ${escapeHtml(p.clientName)}.</h1>
    <p style="font-size: 15px; color: #3D3D3D; margin: 0 0 24px;">
      ${escapeHtml(p.businessName)} has confirmed your booking. Here are the details:
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
      <tr><td style="padding: 8px 0; font-size: 13px; color: #6B6B6B;">Service</td><td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${escapeHtml(p.service)}</td></tr>
      <tr><td style="padding: 8px 0; font-size: 13px; color: #6B6B6B;">Date</td><td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${escapeHtml(dateLine)}</td></tr>
      <tr><td style="padding: 8px 0; font-size: 13px; color: #6B6B6B;">Time</td><td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${escapeHtml(timeLine)}</td></tr>
    </table>
    <p style="font-size: 14px; color: #6B6B6B; margin: 0; line-height: 1.6;">
      Need to change something? ${p.ownerEmail ? `Reply to this email or message ${escapeHtml(p.businessName)} directly.` : `Message ${escapeHtml(p.businessName)} directly.`}
    </p>
  </div>
  <p style="font-size: 12px; color: #9A9893; text-align: center; margin-top: 16px;">Sent via Orbit . the CRM your business runs on</p>
</body></html>`;

  const text = `Hi ${p.clientName},

Your booking with ${p.businessName} is confirmed.

  Service: ${p.service}
  Date:    ${dateLine}
  Time:    ${timeLine}

See you then.

- Orbit`;

  return { subject, html, text };
}

// ─── Cancellation email ────────────────────────────────────────────────────

export function buildCancelEmail(p: BookingMessageParams): {
  subject: string;
  html: string;
  text: string;
} {
  const dateLine = formatDate(p.date);
  const timeLine = formatTime(p.time);

  const subject = `Update on your booking with ${p.businessName}`;
  const html = `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A1A1A; background: #F2F1EF;">
  <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #E5E3DF;">
    <div style="font-size: 12px; font-weight: 700; color: #E8557A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Booking cancelled</div>
    <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">Hi ${escapeHtml(p.clientName)},</h1>
    <p style="font-size: 15px; color: #3D3D3D; margin: 0 0 24px;">
      ${escapeHtml(p.businessName)} can no longer make this booking work:
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
      <tr><td style="padding: 8px 0; font-size: 13px; color: #6B6B6B;">Service</td><td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${escapeHtml(p.service)}</td></tr>
      <tr><td style="padding: 8px 0; font-size: 13px; color: #6B6B6B;">Date</td><td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${escapeHtml(dateLine)}</td></tr>
      <tr><td style="padding: 8px 0; font-size: 13px; color: #6B6B6B;">Time</td><td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${escapeHtml(timeLine)}</td></tr>
    </table>
    <p style="font-size: 14px; color: #6B6B6B; margin: 0; line-height: 1.6;">
      ${p.ownerEmail ? `Reply to this email to reschedule, or reach out directly.` : `Please reach out to ${escapeHtml(p.businessName)} to reschedule.`}
    </p>
  </div>
  <p style="font-size: 12px; color: #9A9893; text-align: center; margin-top: 16px;">Sent via Orbit</p>
</body></html>`;

  const text = `Hi ${p.clientName},

${p.businessName} can no longer make this booking work:

  Service: ${p.service}
  Date:    ${dateLine}
  Time:    ${timeLine}

Reach out to reschedule.

- Orbit`;

  return { subject, html, text };
}

// ─── WhatsApp click-to-chat URL ─────────────────────────────────────────────
//
// wa.me opens WhatsApp Web / mobile app pre-filled with our text. The
// business owner taps "Send" themselves - we can't send programmatically
// without a paid WhatsApp Business API setup, which most small businesses
// won't have. This is the best free path.

function buildConfirmText(p: BookingMessageParams): string {
  return `Hi ${p.clientName}! Your booking with ${p.businessName} is confirmed.

${p.service}
${formatDate(p.date)} at ${formatTime(p.time)}

See you then!`;
}

function buildCancelText(p: BookingMessageParams): string {
  return `Hi ${p.clientName}, unfortunately I won't be able to make our ${p.service} booking on ${formatDate(p.date)} at ${formatTime(p.time)}. Can we reschedule?

- ${p.businessName}`;
}

/**
 * Build a wa.me URL the owner can open in a new tab to send the message via
 * their own WhatsApp account. Returns null if no phone is available.
 *
 * Strips non-digits from the phone but leaves the leading country code intact
 * if present.
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  params: BookingMessageParams,
  action: "confirm" | "cancel",
): string | null {
  if (!phone) return null;

  // wa.me wants digits only, no + or spaces
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 6) return null; // not a real phone number

  const text = action === "confirm" ? buildConfirmText(params) : buildCancelText(params);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
