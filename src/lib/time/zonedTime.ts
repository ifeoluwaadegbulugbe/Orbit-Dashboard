/**
 * Converts a naive wall-clock date+time (as a business owner typed it, e.g.
 * booking.date="2026-09-27", booking.time="23:00") into the true UTC epoch
 * milliseconds for that moment in a given IANA timezone.
 *
 * Needed because Vercel's serverless functions run with TZ=UTC - without
 * this, `new Date(year, month, day, hour, minute)` silently treats the
 * owner's local wall-clock time as if it were already UTC, which is wrong
 * by exactly the owner's UTC offset (e.g. an hour early for Africa/Lagos).
 *
 * Standard technique (no extra dependency): interpret the wall-clock numbers
 * as UTC to get a reference instant, see what that instant reads as when
 * formatted in the target zone, and use the difference to correct it.
 */
export function zonedTimeToUtcMs(dateStr: string, timeStr: string, timeZone: string): number | null {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);

  let offsetMs: number;
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(dtf.formatToParts(new Date(naiveUtc)).map((p) => [p.type, p.value]));
    const asIfUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    offsetMs = asIfUtc - naiveUtc;
  } catch {
    // Invalid/unknown IANA zone string - fall back to treating as UTC
    // rather than throwing and losing the whole cron run over one bad value.
    offsetMs = 0;
  }

  return naiveUtc - offsetMs;
}

/** Orbit is Nigeria-first - used when a profile has no captured timezone yet. */
export const DEFAULT_TIMEZONE = "Africa/Lagos";
