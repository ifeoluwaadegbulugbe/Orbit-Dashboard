import type { Service } from "@/types";

/**
 * Service prices are free-form text ("$80", "Free", "From N5,000") so
 * owners can write whatever reads naturally - see Service in @/types.
 * That means we can't always turn one into a number. This never guesses:
 * a range like "$50-$100" takes the first number as a "starting from"
 * amount, but anything with no number in it at all (blank, "TBD") returns
 * null rather than silently becoming 0.
 */
export function parseServicePrice(priceText: string): number | null {
  const trimmed = priceText.trim();
  if (!trimmed) return null;
  if (/free/i.test(trimmed)) return 0;

  const match = trimmed.match(/[\d,]+\.?\d*/);
  if (!match) return null;

  const num = parseFloat(match[0].replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

/**
 * A booking's title is the service name(s) joined with " + " (see
 * bookingTitle in /api/public/bookings and the service-chip picker in
 * work/page.tsx). Sums the matched services' parsed prices - returns null
 * (don't auto-invoice) if the title doesn't cleanly resolve to configured
 * services with parseable prices, rather than inventing a partial total.
 */
export function computeServiceAmount(
  configuredServices: Pick<Service, "name" | "price">[],
  bookingTitle: string,
): number | null {
  const parts = bookingTitle.split(" + ").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let total = 0;
  for (const part of parts) {
    const match = configuredServices.find((s) => s.name.trim().toLowerCase() === part.toLowerCase());
    if (!match) return null;
    const price = parseServicePrice(match.price);
    if (price === null) return null;
    total += price;
  }
  return total > 0 ? total : null;
}
