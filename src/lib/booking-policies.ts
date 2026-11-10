/**
 * Booking policies (cancellation, lateness, refunds) and service deposits.
 *
 * Owners pick simple options on /booking-link; this turns them into the
 * plain sentences clients read on the booking page, agree to before
 * booking, and get again in their confirmation. Deposits are set per
 * service on /services and requested when the owner confirms a booking.
 */

import { parseServicePrice } from "./services/price.ts";

export type RefundRule = "" | "deposit_non_refundable" | "refund_if_in_time" | "no_refunds";

export interface BookingPolicies {
  /** Notice needed to cancel or move a booking, in hours. 0 = no rule. */
  cancellationHours: number;
  /** Minutes late before the appointment may be shortened, cancelled or charged. 0 = no rule. */
  latenessMinutes: number;
  refunds: RefundRule;
  /** Hours the client has to pay the deposit once the booking is confirmed. 0 = no deadline. */
  depositDeadlineHours: number;
  /** Anything else, in the owner's own words. */
  extra: string;
}

export const EMPTY_POLICIES: BookingPolicies = {
  cancellationHours: 0, latenessMinutes: 0, refunds: "", depositDeadlineHours: 0, extra: "",
};

export const CANCELLATION_OPTIONS = [0, 12, 24, 48];
export const LATENESS_OPTIONS = [0, 10, 15, 30];
export const DEPOSIT_DEADLINE_OPTIONS = [0, 6, 12, 24];
export const MAX_EXTRA_POLICY = 500;

export interface ServiceDeposit {
  kind: "fixed" | "percent";
  /** Naira (or the owner's currency) for "fixed"; 1-100 for "percent". */
  value: number;
}

const hours = (h: number) => (h === 1 ? "1 hour" : `${h} hours`);

/** The policies as short sentences, in the order clients should read them. Empty when none are set. */
export function policyLines(p: Partial<BookingPolicies> | null | undefined): string[] {
  if (!p) return [];
  const lines: string[] = [];
  const cancel = Number(p.cancellationHours) || 0;
  if (cancel > 0) lines.push(`Need to cancel or move your appointment? Please let us know at least ${hours(cancel)} before.`);
  if (p.refunds === "deposit_non_refundable") lines.push("Deposits are non-refundable.");
  else if (p.refunds === "refund_if_in_time") {
    lines.push(cancel > 0
      ? `Cancel at least ${hours(cancel)} before and your deposit is refunded. After that, it isn't.`
      : "Deposits are refunded if you cancel in good time.");
  } else if (p.refunds === "no_refunds") lines.push("Payments are non-refundable.");
  const late = Number(p.latenessMinutes) || 0;
  if (late > 0) lines.push(`If you're more than ${late} minutes late, your appointment may be shortened, cancelled or charged in full.`);
  const deadline = Number(p.depositDeadlineHours) || 0;
  if (deadline > 0) lines.push(`Your booking is secured once the deposit is paid. Please pay within ${hours(deadline)} of confirmation, or the slot may be given to someone else.`);
  const extra = (p.extra ?? "").trim().slice(0, MAX_EXTRA_POLICY);
  if (extra) lines.push(extra);
  return lines;
}

/** Whether the owner set any policy at all. */
export function hasPolicies(p: Partial<BookingPolicies> | null | undefined): boolean {
  return policyLines(p).length > 0;
}

/** Cleans what the editor saves: known options only, sane numbers, trimmed text. */
export function cleanPolicies(p: Partial<BookingPolicies> | null | undefined): BookingPolicies {
  const pick = (v: unknown, allowed: number[]) => (allowed.includes(Number(v)) ? Number(v) : 0);
  const refunds: RefundRule[] = ["", "deposit_non_refundable", "refund_if_in_time", "no_refunds"];
  return {
    cancellationHours: pick(p?.cancellationHours, CANCELLATION_OPTIONS),
    latenessMinutes: pick(p?.latenessMinutes, LATENESS_OPTIONS),
    refunds: refunds.includes(p?.refunds as RefundRule) ? (p!.refunds as RefundRule) : "",
    depositDeadlineHours: pick(p?.depositDeadlineHours, DEPOSIT_DEADLINE_OPTIONS),
    extra: String(p?.extra ?? "").trim().slice(0, MAX_EXTRA_POLICY),
  };
}

/** A valid deposit setting, or null for "no deposit". */
export function cleanDeposit(d: Partial<ServiceDeposit> | null | undefined): ServiceDeposit | null {
  const value = Number(d?.value);
  if (!d || !(value > 0)) return null;
  if (d.kind === "percent") return value <= 100 ? { kind: "percent", value: Math.round(value) } : null;
  if (d.kind === "fixed") return { kind: "fixed", value: Math.round(value * 100) / 100 };
  return null;
}

interface PricedService { name: string; price: string; deposit?: ServiceDeposit | null }

/**
 * The deposit for one service, never more than its price. A percentage
 * needs a price Orbit can read ("₦25,000"); "From ₦5,000"-style text
 * still works (the first number), "Ask me" doesn't, so no deposit.
 */
export function depositForService(s: PricedService): number {
  const d = cleanDeposit(s.deposit);
  if (!d) return 0;
  const price = parseServicePrice(s.price ?? "");
  if (d.kind === "percent") return price && price > 0 ? Math.round((price * d.value) / 100) : 0;
  return price && price > 0 ? Math.min(d.value, price) : d.value;
}

/** Total deposit for a booking whose title is the service names joined with " + ". */
export function depositForBooking(services: PricedService[], bookingTitle: string): number {
  return bookingTitle.split(" + ").map((p) => p.trim().toLowerCase()).filter(Boolean)
    .reduce((sum, part) => {
      const match = services.find((s) => s.name.trim().toLowerCase() === part);
      return sum + (match ? depositForService(match) : 0);
    }, 0);
}
