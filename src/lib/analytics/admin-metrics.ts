/**
 * Internal product-analytics numbers for /admin/analytics.
 *
 * Pure: give it accounts + events, get every metric back - no I/O, so it
 * can be tested against real or fake data. Definitions (what is
 * "meaningful", activation, funnel, thresholds) live in ./catalog.
 * Calendar days are counted in ANALYTICS_TIMEZONE (Lagos by default).
 */

import { computeSubscriptionState } from "@/lib/subscription/isPro";
import {
  ACTIVATION_EVENTS, ADOPTION, ANALYTICS_TIMEZONE, EVENTS, FUNNEL, INACTIVE_AFTER_DAYS, NEW_USER_DAYS,
  isEventName, isMeaningful, type EventName,
} from "./catalog";

export interface AccountRow {
  id: string;
  full_name: string | null;
  business_name: string | null;
  created_at: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
}
export interface EventRow { user_id: string; event: string; actor: string | null; created_at: string }

export type Tier = "free" | "trial" | "pro";
export type Segment = "all" | "new" | "returning";
export type UserStatus = "new" | "active" | "inactive";

export interface Params {
  from: string; // YYYY-MM-DD, inclusive, in the analytics timezone
  to: string;
  tier?: Tier | "all";
  segment?: Segment;
  /** Restrict activity metrics to one event. */
  event?: EventName | "all";
  now?: Date;
  timeZone?: string;
}

export interface SeriesPoint {
  label: string; start: string; end: string;
  signups: number; dau: number; wau: number; actions: number; newActive: number; returningActive: number;
}

export interface AdminAnalytics {
  range: { from: string; to: string; days: number; bucket: "day" | "week"; timeZone: string };
  activityDefinition: { events: { event: EventName; label: string }[]; filteredTo: EventName | null };
  overview: {
    totalUsers: number; newSignups: number; dau: number; wau: number; mau: number;
    activation: { activated: number; cohort: number; pct: number | null };
    weekOneRetention: { retained: number; cohort: number; pct: number | null; minCohort: number };
  };
  series: SeriesPoint[];
  featureUsage: { key: string; label: string; count: number; users: number }[];
  adoption: { label: string; users: number; pct: number | null }[];
  adoptionBase: number;
  funnel: { label: string; users: number; pct: number | null; lost: number }[];
  users: {
    id: string; name: string; createdAt: string; lastActiveAt: string | null; actionsInPeriod: number;
    lastFeature: string | null; tier: Tier; activated: boolean; status: UserStatus;
  }[];
  thresholds: { inactiveAfterDays: number; newUserDays: number };
}

const DAY = 86_400_000;
const MIN_RETENTION_COHORT = 5;

export function dayKey(d: Date | string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}
const keyToMs = (k: string) => Date.parse(`${k}T00:00:00Z`);
const addDays = (k: string, n: number) => new Date(keyToMs(k) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((keyToMs(b) - keyToMs(a)) / DAY);

export function tierOf(a: AccountRow): Tier {
  const s = computeSubscriptionState(a, false);
  return s.isPro ? (s.isOnTrial ? "trial" : "pro") : "free";
}

export function computeAdminAnalytics(accounts: AccountRow[], events: EventRow[], p: Params): AdminAnalytics {
  const tz = p.timeZone ?? ANALYTICS_TIMEZONE;
  const now = p.now ?? new Date();
  const today = dayKey(now, tz);
  const { from, to } = p;
  const days = daysBetween(from, to) + 1;
  const eventFilter = p.event && p.event !== "all" ? p.event : null;

  // ── Population (tier + new/returning filters) ───────────────────────────
  const signupDay = new Map<string, string>();
  const population = accounts.filter((a) => {
    const sd = dayKey(a.created_at, tz);
    signupDay.set(a.id, sd);
    if (sd > to) return false; // didn't exist yet
    if (p.tier && p.tier !== "all" && tierOf(a) !== p.tier) return false;
    if (p.segment === "new" && sd < from) return false;
    if (p.segment === "returning" && sd >= from) return false;
    return true;
  });
  const inPop = new Set(population.map((a) => a.id));

  // ── Index events ────────────────────────────────────────────────────────
  // "activity" = what counts as an active user: meaningful owner actions,
  // or just the filtered event when one is picked.
  const counts = (e: EventRow) =>
    eventFilter ? e.event === eventFilter && (e.actor ?? "owner") !== "system" : isMeaningful(e.event, e.actor);
  const activeDays = new Map<string, Set<string>>(); // day -> users
  const actionsByDay = new Map<string, number>();
  const everDone = new Map<string, Set<string>>(); // user -> events (owner or customer, any time)
  const lastActivity = new Map<string, { at: string; event: string }>();
  const actionsInPeriod = new Map<string, number>();
  const usage = new Map<string, { label: string; count: number; users: Set<string> }>();
  const adoptionUsers = ADOPTION.map(() => new Set<string>());
  const activeInPeriod = new Set<string>();

  for (const e of events) {
    if (!inPop.has(e.user_id) || !isEventName(e.event)) continue;
    const actor = e.actor ?? "owner";
    const d = dayKey(e.created_at, tz);
    if (actor !== "system") {
      if (!everDone.has(e.user_id)) everDone.set(e.user_id, new Set());
      everDone.get(e.user_id)!.add(e.event);
    }
    const inRange = d >= from && d <= to;
    if (inRange) {
      const key = actor === "owner" ? e.event : `${e.event}:${actor}`;
      const label = EVENTS[e.event].label + (actor === "customer" ? " (by customer)" : actor === "system" ? " (automatic)" : "");
      if (!usage.has(key)) usage.set(key, { label, count: 0, users: new Set() });
      const u = usage.get(key)!;
      u.count++;
      u.users.add(e.user_id);
      if (actor === "owner") ADOPTION.forEach((row, i) => { if (row.events.includes(e.event as EventName)) adoptionUsers[i].add(e.user_id); });
    }
    if (!counts(e)) continue;
    if (!activeDays.has(d)) activeDays.set(d, new Set());
    activeDays.get(d)!.add(e.user_id);
    const prev = lastActivity.get(e.user_id);
    if (!prev || e.created_at > prev.at) lastActivity.set(e.user_id, { at: e.created_at, event: e.event });
    if (inRange) {
      actionsByDay.set(d, (actionsByDay.get(d) ?? 0) + 1);
      actionsInPeriod.set(e.user_id, (actionsInPeriod.get(e.user_id) ?? 0) + 1);
      activeInPeriod.add(e.user_id);
    }
  }

  const uniqueOver = (endDay: string, span: number) => {
    const s = new Set<string>();
    for (let i = 0; i < span; i++) activeDays.get(addDays(endDay, -i))?.forEach((u) => s.add(u));
    return s;
  };

  // ── Series ───────────────────────────────────────────────────────────────
  const bucket: "day" | "week" = days > 45 ? "week" : "day";
  const signupsByDay = new Map<string, number>();
  for (const a of population) {
    const sd = signupDay.get(a.id)!;
    signupsByDay.set(sd, (signupsByDay.get(sd) ?? 0) + 1);
  }
  const series: SeriesPoint[] = [];
  const step = bucket === "week" ? 7 : 1;
  for (let start = from; start <= to; start = addDays(start, step)) {
    const end = [addDays(start, step - 1), to].sort()[0];
    const span = daysBetween(start, end) + 1;
    let signups = 0, actions = 0, dauSum = 0;
    const activeUsers = new Set<string>();
    for (let i = 0; i < span; i++) {
      const d = addDays(start, i);
      signups += signupsByDay.get(d) ?? 0;
      actions += actionsByDay.get(d) ?? 0;
      dauSum += activeDays.get(d)?.size ?? 0;
      activeDays.get(d)?.forEach((u) => activeUsers.add(u));
    }
    let newActive = 0;
    activeUsers.forEach((u) => { if (daysBetween(signupDay.get(u)!, end) < NEW_USER_DAYS) newActive++; });
    series.push({
      label: bucket === "day" ? start : `${start} – ${end}`,
      start, end, signups, actions,
      dau: Math.round((dauSum / span) * 10) / 10, // average per day for weekly buckets
      wau: uniqueOver(end, 7).size,
      newActive, returningActive: activeUsers.size - newActive,
    });
  }

  // ── Activation & funnel (cohort = signed up in range) ────────────────────
  const cohort = population.filter((a) => signupDay.get(a.id)! >= from);
  const reached = (u: string, step: (typeof FUNNEL)[number]) =>
    step.events === "signup" || step.events.some((ev) => everDone.get(u)?.has(ev));
  const funnel: AdminAnalytics["funnel"] = [];
  let remaining = cohort.map((a) => a.id);
  FUNNEL.forEach((step, i) => {
    const before = remaining.length;
    remaining = remaining.filter((u) => reached(u, step));
    funnel.push({
      label: step.label,
      users: remaining.length,
      pct: cohort.length ? Math.round((remaining.length / cohort.length) * 1000) / 10 : null,
      lost: i === 0 ? 0 : before - remaining.length,
    });
  });
  const isActivated = (u: string) => ACTIVATION_EVENTS.some((ev) => everDone.get(u)?.has(ev));
  const activatedInCohort = cohort.filter((a) => isActivated(a.id)).length;

  // ── Week-one retention: active on days 7-13 after signup ─────────────────
  const retentionCohort = population.filter((a) => {
    const sd = signupDay.get(a.id)!;
    return sd >= from && addDays(sd, 13) <= [to, today].sort()[0];
  });
  const retained = retentionCohort.filter((a) => {
    const sd = signupDay.get(a.id)!;
    for (let i = 7; i <= 13; i++) if (activeDays.get(addDays(sd, i))?.has(a.id)) return true;
    return false;
  }).length;

  // ── Users table ──────────────────────────────────────────────────────────
  const users = population.map((a) => {
    const last = lastActivity.get(a.id) ?? null;
    const sinceSignup = daysBetween(signupDay.get(a.id)!, today);
    const sinceActive = last ? daysBetween(dayKey(last.at, tz), today) : Infinity;
    const status: UserStatus = sinceSignup < NEW_USER_DAYS ? "new" : sinceActive < INACTIVE_AFTER_DAYS ? "active" : "inactive";
    return {
      id: a.id,
      name: a.business_name?.trim() || a.full_name?.trim() || "Unnamed account",
      createdAt: a.created_at,
      lastActiveAt: last?.at ?? null,
      actionsInPeriod: actionsInPeriod.get(a.id) ?? 0,
      lastFeature: last && isEventName(last.event) ? EVENTS[last.event].label : null,
      tier: tierOf(a),
      activated: isActivated(a.id),
      status,
    };
  });

  const activityEvents = (Object.keys(EVENTS) as EventName[]).filter((e) => (eventFilter ? e === eventFilter : EVENTS[e].meaningful));
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

  return {
    range: { from, to, days, bucket, timeZone: tz },
    activityDefinition: { events: activityEvents.map((e) => ({ event: e, label: EVENTS[e].label })), filteredTo: eventFilter },
    overview: {
      totalUsers: population.length,
      newSignups: cohort.length,
      dau: activeDays.get(to)?.size ?? 0,
      wau: uniqueOver(to, 7).size,
      mau: uniqueOver(to, 30).size,
      activation: { activated: activatedInCohort, cohort: cohort.length, pct: pct(activatedInCohort, cohort.length) },
      weekOneRetention: {
        retained, cohort: retentionCohort.length, minCohort: MIN_RETENTION_COHORT,
        pct: retentionCohort.length >= MIN_RETENTION_COHORT ? pct(retained, retentionCohort.length) : null,
      },
    },
    series,
    featureUsage: [...usage.entries()]
      .map(([key, v]) => ({ key, label: v.label, count: v.count, users: v.users.size }))
      .sort((a, b) => b.count - a.count),
    adoption: ADOPTION.map((row, i) => ({ label: row.label, users: adoptionUsers[i].size, pct: pct(adoptionUsers[i].size, activeInPeriod.size) })),
    adoptionBase: activeInPeriod.size,
    funnel,
    users,
    thresholds: { inactiveAfterDays: INACTIVE_AFTER_DAYS, newUserDays: NEW_USER_DAYS },
  };
}
