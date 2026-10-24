/**
 * Calendar date (YYYY-MM-DD) of a moment in a timezone. Built from parts
 * rather than relying on a locale's date format: phones disagree on what
 * "en-CA" looks like ("2026-10-25" on some, "25/10/2026" on others).
 */
export function ymdInZone(at: Date | string | number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
