/**
 * Turns a phone number as people type it into the digits wa.me needs.
 *   "+254 712 345 678"      -> "254712345678"
 *   "00233 24 123 4567"     -> "233241234567"
 *   "0803 123 4567" (NG)    -> "2348031234567"   (local 0 -> country code)
 * `dialCode` is the business's own country code, since that's where a
 * number typed without a country code almost always belongs.
 */
export function toWhatsAppDigits(raw: string | null | undefined, dialCode = "234"): string | null {
  const s = (raw ?? "").trim();
  let digits = s.replace(/\D/g, "");
  if (!s.startsWith("+")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0") && dialCode) digits = dialCode + digits.slice(1);
  }
  return digits.length >= 7 ? digits : null;
}
