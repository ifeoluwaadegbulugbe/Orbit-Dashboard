/**
 * When an Orbit Pay payment should reach the business's bank. Paystack
 * settles Nigerian payments the next business day (T+1); payments made on
 * a weekend or public holiday settle on the next working day.
 *
 * This is an estimate shown to the business ("arrives by ..."). The real
 * payout is confirmed from Paystack by /api/cron/orbit-pay-settlements.
 * Islamic holidays (Eid) are announced each year, so they aren't in the
 * list - on those days the confirmed status is what counts.
 */

import { ymdInZone } from "../time/ymd.ts";

const TZ = "Africa/Lagos";
const DAY = 86_400_000;

/** Fixed-date Nigerian public holidays (MM-DD). */
const FIXED_HOLIDAYS = ["01-01", "05-01", "06-12", "10-01", "12-25", "12-26"];

/** Easter Sunday (Anonymous Gregorian algorithm), as YYYY-MM-DD. */
function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const shift = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

function isHoliday(ymd: string): boolean {
  if (FIXED_HOLIDAYS.includes(ymd.slice(5))) return true;
  const easter = easterSunday(Number(ymd.slice(0, 4)));
  return ymd === shift(easter, -2) /* Good Friday */ || ymd === shift(easter, 1) /* Easter Monday */;
}

function isBusinessDay(ymd: string): boolean {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !isHoliday(ymd);
}

/** Lagos calendar date (YYYY-MM-DD) the payout should arrive by. */
export function expectedPayoutDate(paidAt: string | Date): string {
  let d = ymdInZone(paidAt, TZ);
  do { d = shift(d, 1); } while (!isBusinessDay(d));
  return d;
}

/** "Monday 26 Oct" */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Spelled out by hand so every phone shows the same thing. */
export function formatPayoutDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "OPay Digital Services Limited (OPay)" -> "OPay" */
export function shortBankName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  const inBrackets = /\(([^)]+)\)\s*$/.exec(n);
  return inBrackets ? inBrackets[1] : n || "bank";
}
