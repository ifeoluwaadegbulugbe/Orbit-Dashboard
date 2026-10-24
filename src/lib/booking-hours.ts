/**
 * Opening hours and free time slots for the public booking page. Pure
 * functions (no I/O), shared by the page, the availability API and the
 * booking API, so what clients can pick and what the server accepts match.
 */

export interface OpeningHours {
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  /** "09:00" */
  open: string;
  /** "18:00" */
  close: string;
}

/** Minutes between slot start times. */
export const SLOT_STEP_MINUTES = 30;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function validHours(h: unknown): h is OpeningHours {
  if (!h || typeof h !== "object") return false;
  const x = h as OpeningHours;
  return Array.isArray(x.days) && x.days.length > 0 && x.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    && /^\d{2}:\d{2}$/.test(x.open) && /^\d{2}:\d{2}$/.test(x.close) && toMinutes(x.close) > toMinutes(x.open);
}

/** "9am", "6:30pm" */
export function prettyTime(hhmm: string): string {
  const min = toMinutes(hhmm);
  const h = Math.floor(min / 60), m = min % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

/** "Mon–Fri · 9am–6pm", "Mon, Wed, Fri · 10am–4pm" */
export function hoursLabel(h: OpeningHours): string {
  const days = [...new Set(h.days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Monday first
  const order = days.map((d) => (d + 6) % 7);
  const consecutive = order.every((v, i) => i === 0 || v === order[i - 1] + 1);
  const dayText = days.length === 7 ? "Every day"
    : consecutive && days.length > 2 ? `${DAY_SHORT[days[0]]}–${DAY_SHORT[days[days.length - 1]]}`
    : days.map((d) => DAY_SHORT[d]).join(", ");
  return `${dayText} · ${prettyTime(h.open)}–${prettyTime(h.close)}`;
}

export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

export interface Busy { start: number; end: number } // minutes from midnight

/**
 * Start times on `date` where a booking of `durationMin` fits inside opening
 * hours without overlapping `busy`. `nowMin` (minutes since midnight, for
 * today) hides times that have already passed.
 */
export function freeSlots(h: OpeningHours, date: string, durationMin: number, busy: Busy[], nowMin?: number): string[] {
  if (!h.days.includes(weekdayOf(date))) return [];
  const open = toMinutes(h.open), close = toMinutes(h.close);
  const dur = Math.max(15, durationMin || 60);
  const out: string[] = [];
  for (let t = open; t + dur <= close; t += SLOT_STEP_MINUTES) {
    if (nowMin !== undefined && t <= nowMin) continue;
    if (busy.some((b) => t < b.end && t + dur > b.start)) continue;
    out.push(toHHMM(t));
  }
  return out;
}

/** "5000" -> "₦5,000". Words ("Free", "From ₦5k") are left as written. */
export function displayPrice(price: string, symbol: string): string {
  const p = (price ?? "").trim();
  if (!p) return "Price on request";
  if (/^\d[\d,]*(\.\d+)?$/.test(p)) {
    const n = Number(p.replace(/,/g, ""));
    return `${symbol}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return p;
}
