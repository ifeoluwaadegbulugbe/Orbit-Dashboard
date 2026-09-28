/**
 * Builds a "tap to send" wa.me link with the message pre-filled - the owner
 * still has to tap send themselves. Automated business-initiated WhatsApp
 * messages require a Business API provider (Twilio, Meta Cloud API, etc.)
 * with pre-approved message templates, which this project doesn't have
 * configured; this is the zero-setup alternative used everywhere Orbit
 * suggests a client-facing message (payment reminders, follow-ups, birthday
 * wishes) alongside email.
 */
export function buildWhatsAppLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return null; // not a real phone number
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
