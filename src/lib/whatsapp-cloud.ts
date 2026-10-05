/**
 * Automatic WhatsApp messages via Meta's WhatsApp Cloud API, sent from
 * Orbit's own WhatsApp Business number on behalf of each business (the
 * business name is part of every message).
 *
 * Business-initiated messages must use templates pre-approved in Meta's
 * WhatsApp Manager. Create these (category: Utility, language: English)
 * with exactly these names and numbered variables:
 *
 *   orbit_booking_confirmed
 *     Hi {{1}}, your {{2}} with {{3}} is confirmed for {{4}}.
 *     See your appointments or book again here: {{5}} - see you soon!
 *
 *   orbit_appointment_reminder
 *     Hi {{1}}, a reminder that your {{2}} with {{3}} is {{4}}.   ({{4}} = "in 1 hour, at 2:30pm")
 *     Need to change it? Reply to {{3}} directly.
 *
 *   orbit_review_request
 *     Hi {{1}}, thank you for visiting {{2}}! How was your {{3}}?
 *     Leave a quick review here: {{4}} - it only takes 30 seconds.
 *
 * (Meta rejects templates that begin or end with a variable, hence the
 * closing words after the links.)
 *
 * Env:
 *   WHATSAPP_ACCESS_TOKEN     permanent System User token with whatsapp_business_messaging
 *   WHATSAPP_PHONE_NUMBER_ID  the sending number's ID (not the phone number itself)
 *   WHATSAPP_API_VERSION      optional, defaults to v23.0
 *   WHATSAPP_TEMPLATE_LANG    optional, defaults to "en"
 *
 * Without the first two, every send returns { skipped: true } and Orbit
 * falls back to its tap-to-send wa.me links.
 */

import "server-only";

export type WhatsAppTemplate = "orbit_booking_confirmed" | "orbit_appointment_reminder" | "orbit_review_request";

export interface WhatsAppResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

export function whatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Normalises to digits-only international format. Nigerian local numbers
 * (0803...) become 234803...; anything already international is kept.
 */
export function toWhatsAppNumber(raw: string | null | undefined, defaultCountryCode = "234"): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = defaultCountryCode + d.slice(1);
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export async function sendWhatsAppTemplate(
  to: string | null | undefined,
  template: WhatsAppTemplate,
  params: string[],
): Promise<WhatsAppResult> {
  if (!whatsappConfigured()) return { ok: false, skipped: true, error: "WhatsApp not configured" };
  const number = toWhatsAppNumber(to);
  if (!number) return { ok: false, skipped: true, error: "No valid WhatsApp number" };

  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: number,
          type: "template",
          template: {
            name: template,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
            components: [
              {
                type: "body",
                // Template variables can't contain newlines/tabs or 4+ spaces.
                parameters: params.map((p) => ({ type: "text", text: clean(p) })),
              },
            ],
          },
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `WhatsApp API ${res.status}` };
    return { ok: true, id: json.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function clean(text: string): string {
  return (text || "-").replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 1000) || "-";
}
