/**
 * Pure business-analytics calculations for the Insights page.
 *
 * Everything here takes the raw rows the app already loads (clients,
 * payments, bookings) and returns plain numbers - no fetching, no React -
 * so the maths is easy to reason about and reuse.
 *
 * Conventions:
 *  - Revenue is "cash collected": paid_amount on paid/partial invoices,
 *    dated by when it was paid (payment_completed_at), falling back to the
 *    invoice date for older rows that never recorded one.
 *  - "Invoiced" is the face value of invoices, dated by created_at.
 *  - Every period metric is also computed for the equal-length period just
 *    before it, so the UI can show a trend (▲ 12%).
 */

import type { Booking, Client, Payment } from "@/types";

export type PeriodKey = "30d" | "90d" | "12m";

export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "12m", label: "12 months", days: 365 },
];

const DAY = 86_400_000;

interface Range { start: number; end: number }

function rangeFor(days: number, now: number): { current: Range; previous: Range } {
  const end = now;
  const start = end - days * DAY;
  return { current: { start, end }, previous: { start: start - days * DAY, end: start } };
}

const inRange = (t: number, r: Range) => t >= r.start && t < r.end;

/** Parse "YYYY-MM-DD" as a local date (not UTC midnight). */
function localDate(s: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  return new Date(s).getTime();
}

/** Cash actually received on an invoice. */
export function collectedAmount(p: Payment): number {
  if (p.status === "paid") return p.paid_amount ?? p.amount;
  if (p.status === "partial") return p.paid_amount ?? 0;
  return 0;
}

/** When the money arrived. */
export function paidAt(p: Payment): number {
  return p.payment_completed_at ? new Date(p.payment_completed_at).getTime() : localDate(p.date);
}

/** Still owed on an invoice. */
export function owedAmount(p: Payment): number {
  if (p.status === "paid" || p.status === "failed" || p.status === "refunded") return 0;
  return p.remaining_balance ?? Math.max(0, p.amount - (p.paid_amount ?? 0));
}

/** % change, or null when there's no baseline to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Money ──────────────────────────────────────────────────────────────────

export interface MoneyStats {
  collected: number;
  collectedPrev: number;
  invoiced: number;
  invoicedPrev: number;
  invoiceCount: number;
  avgInvoice: number;
  avgInvoicePrev: number;
  /** Share of invoiced value (in the period) that has been collected. */
  collectionRate: number | null;
  /** Mean days from invoice created to paid, for invoices paid in the period. */
  avgDaysToPay: number | null;
}

export function moneyStats(payments: Payment[], days: number, now = Date.now()): MoneyStats {
  const { current, previous } = rangeFor(days, now);
  let collected = 0, collectedPrev = 0;
  let invoiced = 0, invoicedPrev = 0, count = 0, countPrev = 0, invoicedCollected = 0;
  const payDurations: number[] = [];

  for (const p of payments) {
    const got = collectedAmount(p);
    if (got > 0) {
      const t = paidAt(p);
      if (inRange(t, current)) {
        collected += got;
        if (p.status === "paid" && p.payment_completed_at) {
          const d = (t - new Date(p.created_at).getTime()) / DAY;
          if (d >= 0) payDurations.push(d);
        }
      } else if (inRange(t, previous)) collectedPrev += got;
    }
    if (p.status === "failed" || p.status === "refunded") continue;
    const created = new Date(p.created_at).getTime();
    if (inRange(created, current)) {
      invoiced += p.amount; count++; invoicedCollected += got;
    } else if (inRange(created, previous)) {
      invoicedPrev += p.amount; countPrev++;
    }
  }

  return {
    collected, collectedPrev, invoiced, invoicedPrev,
    invoiceCount: count,
    avgInvoice: count ? invoiced / count : 0,
    avgInvoicePrev: countPrev ? invoicedPrev / countPrev : 0,
    collectionRate: invoiced > 0 ? Math.round((invoicedCollected / invoiced) * 100) : null,
    avgDaysToPay: payDurations.length
      ? Math.round(payDurations.reduce((a, b) => a + b, 0) / payDurations.length)
      : null,
  };
}

export interface MonthPoint { key: string; label: string; collected: number; invoiced: number }

/** Collected vs invoiced per calendar month, oldest first. */
export function monthlyTrend(payments: Payment[], months: number, now = new Date()): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      collected: 0,
      invoiced: 0,
    });
  }
  const idx = new Map(points.map((p, i) => [p.key, i]));
  const keyOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}`; };
  for (const p of payments) {
    const got = collectedAmount(p);
    if (got > 0) {
      const i = idx.get(keyOf(paidAt(p)));
      if (i !== undefined) points[i].collected += got;
    }
    if (p.status !== "failed" && p.status !== "refunded") {
      const i = idx.get(keyOf(new Date(p.created_at).getTime()));
      if (i !== undefined) points[i].invoiced += p.amount;
    }
  }
  return points;
}

// ─── Receivables ────────────────────────────────────────────────────────────

export interface AgingBucket { label: string; amount: number; count: number; tone: "ok" | "warn" | "bad" | "worst" }

export interface Receivables {
  outstanding: number;
  overdue: number;
  buckets: AgingBucket[];
  topDebtors: { clientId: string; name: string; amount: number; oldestDays: number }[];
}

/** Outstanding money grouped by how far past the due date it is. */
export function receivables(payments: Payment[], now = Date.now()): Receivables {
  const buckets: AgingBucket[] = [
    { label: "Not yet due", amount: 0, count: 0, tone: "ok" },
    { label: "1-30 days late", amount: 0, count: 0, tone: "warn" },
    { label: "31-60 days late", amount: 0, count: 0, tone: "bad" },
    { label: "61-90 days late", amount: 0, count: 0, tone: "bad" },
    { label: "90+ days late", amount: 0, count: 0, tone: "worst" },
  ];
  const debtors = new Map<string, { clientId: string; name: string; amount: number; oldestDays: number }>();
  let outstanding = 0, overdue = 0;

  for (const p of payments) {
    const owed = owedAmount(p);
    if (owed <= 0) continue;
    outstanding += owed;
    const late = Math.floor((now - localDate(p.date)) / DAY);
    const b = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    buckets[b].amount += owed;
    buckets[b].count++;
    if (late > 0) overdue += owed;

    const d = debtors.get(p.client_id) ?? { clientId: p.client_id, name: p.client_name, amount: 0, oldestDays: 0 };
    d.amount += owed;
    d.oldestDays = Math.max(d.oldestDays, late);
    debtors.set(p.client_id, d);
  }

  return {
    outstanding, overdue, buckets,
    topDebtors: [...debtors.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
  };
}

// ─── Clients ────────────────────────────────────────────────────────────────

export interface ClientStats {
  total: number;
  newInPeriod: number;
  newPrev: number;
  /** % of clients who have come back (2+ bookings or 2+ paid invoices). */
  repeatRate: number | null;
  /** Average lifetime revenue per paying client. */
  avgLifetimeValue: number;
  /** Share of all-time revenue from the top 3 clients. */
  top3Share: number | null;
  topClients: { id: string; name: string; revenue: number; share: number; visits: number }[];
  /** Paying clients with no booking or payment in the last 60 days. */
  atRisk: { id: string; name: string; lastSeenDays: number; revenue: number }[];
}

export function clientStats(
  clients: Client[], payments: Payment[], bookings: Booking[], days: number, now = Date.now(),
): ClientStats {
  const { current, previous } = rangeFor(days, now);

  const revenueBy = new Map<string, number>();
  const paidCountBy = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  const seen = (id: string, t: number) => lastSeen.set(id, Math.max(lastSeen.get(id) ?? 0, t));

  for (const p of payments) {
    const got = collectedAmount(p);
    if (got <= 0) continue;
    revenueBy.set(p.client_id, (revenueBy.get(p.client_id) ?? 0) + got);
    paidCountBy.set(p.client_id, (paidCountBy.get(p.client_id) ?? 0) + 1);
    seen(p.client_id, paidAt(p));
  }
  const visitsBy = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const t = localDate(b.date);
    if (t > now) continue; // future bookings aren't visits yet
    visitsBy.set(b.client_id, (visitsBy.get(b.client_id) ?? 0) + 1);
    seen(b.client_id, t);
  }

  let newInPeriod = 0, newPrev = 0, repeaters = 0, engaged = 0;
  for (const c of clients) {
    const t = new Date(c.created_at).getTime();
    if (inRange(t, current)) newInPeriod++;
    else if (inRange(t, previous)) newPrev++;
    const visits = visitsBy.get(c.id) ?? 0;
    const paid = paidCountBy.get(c.id) ?? 0;
    if (visits > 0 || paid > 0) {
      engaged++;
      if (visits >= 2 || paid >= 2) repeaters++;
    }
  }

  const totalRevenue = [...revenueBy.values()].reduce((a, b) => a + b, 0);
  const nameOf = new Map(clients.map((c) => [c.id, c.name]));
  const ranked = [...revenueBy.entries()]
    .map(([id, revenue]) => ({
      id,
      name: nameOf.get(id) ?? payments.find((p) => p.client_id === id)?.client_name ?? "Client",
      revenue,
      share: totalRevenue ? Math.round((revenue / totalRevenue) * 100) : 0,
      visits: visitsBy.get(id) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const atRisk = ranked
    .map((c) => ({ ...c, lastSeenDays: Math.floor((now - (lastSeen.get(c.id) ?? 0)) / DAY) }))
    .filter((c) => c.lastSeenDays > 60 && nameOf.has(c.id))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(({ id, name, lastSeenDays, revenue }) => ({ id, name, lastSeenDays, revenue }));

  return {
    total: clients.length,
    newInPeriod, newPrev,
    repeatRate: engaged ? Math.round((repeaters / engaged) * 100) : null,
    avgLifetimeValue: revenueBy.size ? totalRevenue / revenueBy.size : 0,
    top3Share: totalRevenue && ranked.length > 3
      ? Math.round((ranked.slice(0, 3).reduce((a, c) => a + c.revenue, 0) / totalRevenue) * 100)
      : null,
    topClients: ranked.slice(0, 5),
    atRisk,
  };
}

// ─── Bookings ───────────────────────────────────────────────────────────────

export interface BookingStats {
  total: number;
  totalPrev: number;
  completionRate: number | null;
  cancellationRate: number | null;
  /** Sun..Sat counts. */
  byWeekday: number[];
  /** Counts per hour 0-23. */
  byHour: number[];
  busiestDay: string | null;
  busiestHour: string | null;
  upcoming: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function bookingStats(bookings: Booking[], days: number, now = Date.now()): BookingStats {
  const { current, previous } = rangeFor(days, now);
  const byWeekday = Array(7).fill(0);
  const byHour = Array(24).fill(0);
  let total = 0, totalPrev = 0, done = 0, cancelled = 0, upcoming = 0;

  for (const b of bookings) {
    const t = localDate(b.date);
    // Upcoming = start time still ahead (a 10:00 booking today counts until 10:00).
    const [hh, mm] = (b.time ?? "").split(":").map(Number);
    const startsAt = t + ((hh || 0) * 60 + (mm || 0)) * 60_000;
    if (startsAt >= now && b.status !== "cancelled") upcoming++;
    if (inRange(t, previous)) totalPrev++;
    if (!inRange(t, current)) continue;
    total++;
    if (b.status === "cancelled") { cancelled++; continue; }
    if (b.status === "completed" || b.status === "confirmed") done++;
    byWeekday[new Date(t).getDay()]++;
    const h = parseInt((b.time ?? "").slice(0, 2), 10);
    if (!Number.isNaN(h)) byHour[h]++;
  }

  const maxDay = Math.max(...byWeekday);
  const maxHour = Math.max(...byHour);
  const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

  return {
    total, totalPrev,
    completionRate: total ? Math.round((done / total) * 100) : null,
    cancellationRate: total ? Math.round((cancelled / total) * 100) : null,
    byWeekday, byHour,
    busiestDay: maxDay > 0 ? WEEKDAYS[byWeekday.indexOf(maxDay)] : null,
    busiestHour: maxHour > 0 ? hourLabel(byHour.indexOf(maxHour)) : null,
    upcoming,
  };
}

// ─── Services ───────────────────────────────────────────────────────────────

/** Revenue from invoices with no booking or line items to say what they were for. */
export const UNLINKED = "Not linked to a service";

export interface ServiceRow { name: string; bookings: number; revenue: number }

/**
 * Bookings per service (booking title) and revenue per service. Revenue is
 * attributed via the booking an invoice was created from, else the invoice's
 * line items, else "Other".
 */
export function serviceStats(payments: Payment[], bookings: Booking[], days: number, now = Date.now()): ServiceRow[] {
  const { current } = rangeFor(days, now);
  const rows = new Map<string, ServiceRow>();
  const row = (name: string) => {
    const key = name.trim() || UNLINKED;
    if (!rows.has(key)) rows.set(key, { name: key, bookings: 0, revenue: 0 });
    return rows.get(key)!;
  };
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  for (const b of bookings) {
    if (b.status === "cancelled" || !inRange(localDate(b.date), current)) continue;
    row(b.title).bookings++;
  }
  for (const p of payments) {
    const got = collectedAmount(p);
    if (got <= 0 || !inRange(paidAt(p), current)) continue;
    const linked = p.booking_id ? bookingById.get(p.booking_id) : undefined;
    if (linked) { row(linked.title).revenue += got; continue; }
    const items = (p.line_items ?? []).filter((i) => i.amount > 0);
    const itemsTotal = items.reduce((a, i) => a + i.amount, 0);
    if (items.length && itemsTotal > 0) {
      // Spread what was actually collected across the items proportionally.
      for (const i of items) row(i.description).revenue += got * (i.amount / itemsTotal);
    } else {
      row(UNLINKED).revenue += got;
    }
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings);
}

// ─── Plain-English highlights ───────────────────────────────────────────────

export interface Highlight { tone: "good" | "warn" | "info"; text: string }

export function highlights(
  money: MoneyStats, recv: Receivables, clients: ClientStats, bookings: BookingStats,
  periodLabel: string, fmt: (n: number) => string,
): Highlight[] {
  const out: Highlight[] = [];
  const rev = pctChange(money.collected, money.collectedPrev);
  if (rev !== null && money.collectedPrev > 0 && Math.abs(rev) >= 5) {
    out.push({
      tone: rev > 0 ? "good" : "warn",
      text: `Revenue is ${rev > 0 ? "up" : "down"} ${Math.abs(rev)}% compared with the previous ${periodLabel}.`,
    });
  }
  const late = recv.buckets.slice(2).reduce((a, b) => a + b.amount, 0);
  if (late > 0) {
    out.push({ tone: "warn", text: `${fmt(late)} has been unpaid for more than 30 days past its due date.` });
  }
  if (clients.top3Share !== null && clients.top3Share >= 50) {
    out.push({
      tone: "info",
      text: `Your top 3 clients bring in ${clients.top3Share}% of your revenue. Growing more regulars lowers that risk.`,
    });
  }
  if (clients.atRisk.length > 0) {
    out.push({
      tone: "warn",
      text: `${clients.atRisk.length} paying client${clients.atRisk.length === 1 ? " hasn't" : "s haven't"} been back in over 60 days.`,
    });
  }
  if (bookings.busiestDay) {
    out.push({
      tone: "info",
      text: `${bookings.busiestDay}s are your busiest day${bookings.busiestHour ? `, and ${bookings.busiestHour} your busiest hour` : ""}.`,
    });
  }
  if (money.avgDaysToPay !== null) {
    out.push({
      tone: money.avgDaysToPay > 14 ? "warn" : "good",
      text: `Clients take ${money.avgDaysToPay} day${money.avgDaysToPay === 1 ? "" : "s"} on average to pay an invoice.`,
    });
  }
  return out.slice(0, 5);
}
