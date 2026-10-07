/**
 * Orbit's activation model, lifecycle stage and "next best action".
 *
 * Pure functions over a snapshot of what an owner has actually done, so the
 * same rules drive the lifecycle emails (server) and the setup checklist on
 * Home (browser). To change what "activated" means, edit ACTIVATION_STEPS -
 * nothing else needs rewriting.
 */

export interface UserFacts {
  signedUpAt: string;
  lastActiveAt: string | null;
  isPro: boolean;
  hasBusinessName: boolean;
  serviceCount: number;
  /** A booking-link slug is saved, so /book/<slug> is live. */
  bookingLinkLive: boolean;
  clientCount: number;
  bookingCount: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  reminderCount: number;
}

export type StepId = "business_profile" | "first_service" | "first_client" | "booking_link_or_invoice";

export interface ActivationStep {
  id: StepId;
  label: string;
  /** One clear action for buttons and sentences ("one email = one action"). */
  action: string;
  href: string;
  done: (f: UserFacts) => boolean;
}

/** Edit this list to change the activation definition. */
export const ACTIVATION_STEPS: ActivationStep[] = [
  { id: "business_profile", label: "Add your business name", action: "Add your business name", href: "/profile", done: (f) => f.hasBusinessName },
  { id: "first_service", label: "Add your first service", action: "Add your first service", href: "/services", done: (f) => f.serviceCount > 0 },
  { id: "first_client", label: "Add your first client", action: "Add your first client", href: "/clients/new", done: (f) => f.clientCount > 0 },
  {
    id: "booking_link_or_invoice",
    label: "Publish your booking link or send an invoice",
    action: "Publish your booking link",
    href: "/booking-link",
    done: (f) => f.bookingLinkLive || f.invoiceCount > 0,
  },
];

export function activation(f: UserFacts) {
  const steps = Object.fromEntries(ACTIVATION_STEPS.map((s) => [s.id, s.done(f)])) as Record<StepId, boolean>;
  const doneCount = Object.values(steps).filter(Boolean).length;
  return {
    steps,
    doneCount,
    total: ACTIVATION_STEPS.length,
    pct: Math.round((doneCount / ACTIVATION_STEPS.length) * 100),
    activated: doneCount === ACTIVATION_STEPS.length,
  };
}

/**
 * The first real business outcome - the "aha" moment. Once reached, setup
 * nudges stop and the owner moves into the engagement lifecycle.
 */
export function firstValueAchieved(f: UserFacts): boolean {
  return f.bookingCount > 0 || f.paidInvoiceCount > 0 || f.clientCount >= 5;
}

export type NextBestAction =
  | "CREATE_SERVICE"
  | "CREATE_BOOKING_LINK"
  | "ADD_CLIENT"
  | "CREATE_INVOICE"
  | "COLLECT_PAYMENT"
  | "ENABLE_REMINDERS"
  | "USE_ANALYTICS"
  | "RETURN_TO_ORBIT";

const DAY = 86_400_000;

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

/** Simple ordered rules - the one most useful thing for this owner to do next. */
export function nextBestAction(f: UserFacts, now = Date.now()): NextBestAction {
  const idle = daysSince(f.lastActiveAt ?? f.signedUpAt, now) ?? 0;
  if (idle >= 7) return "RETURN_TO_ORBIT";
  if (f.serviceCount === 0) return "CREATE_SERVICE";
  if (f.clientCount === 0) return "ADD_CLIENT";
  if (!f.bookingLinkLive) return "CREATE_BOOKING_LINK";
  if (f.invoiceCount === 0) return "CREATE_INVOICE";
  if (f.paidInvoiceCount === 0) return "COLLECT_PAYMENT";
  if (f.reminderCount === 0 && f.clientCount >= 3) return "ENABLE_REMINDERS";
  return "USE_ANALYTICS";
}

export type LifecycleStage =
  | "NEW_SIGNUP" | "ACTIVATING" | "ACTIVATED" | "ENGAGED" | "POWER_USER"
  | "FREE_HIGH_INTENT" | "PAID" | "AT_RISK" | "INACTIVE" | "CHURNED";

/** Where the owner is in the lifecycle, from behaviour rather than age alone. */
export function lifecycleStage(f: UserFacts, now = Date.now()): LifecycleStage {
  const sinceSignup = daysSince(f.signedUpAt, now) ?? 0;
  const idle = daysSince(f.lastActiveAt ?? f.signedUpAt, now) ?? 0;
  const act = activation(f);
  const usage = f.clientCount + f.bookingCount + f.invoiceCount;

  if (idle >= 60) return "CHURNED";
  if (idle >= 30) return "INACTIVE";
  if (idle >= 14 && usage > 0) return "AT_RISK";
  if (f.isPro) return "PAID";
  if (usage >= 30 || (f.clientCount >= 15 && f.bookingCount >= 10)) return "FREE_HIGH_INTENT";
  if (usage >= 15) return "POWER_USER";
  if (act.activated && firstValueAchieved(f)) return "ENGAGED";
  if (act.activated) return "ACTIVATED";
  if (sinceSignup <= 1 && act.doneCount === 0) return "NEW_SIGNUP";
  return "ACTIVATING";
}
