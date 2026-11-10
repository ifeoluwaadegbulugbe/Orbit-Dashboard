/**
 * Emails for owners past onboarding: Pro trial reminders, the Monday weekly
 * summary and the Thursday tip. Same rules as campaigns.ts - each one is
 * eligible only while it's true and useful, and the engine sends at most one
 * per run. The summary and tips are for people actively using Orbit; anyone
 * away for a week or more gets the come-back emails instead, never both.
 *
 * Trial reminders are account emails: the card on file is charged when the
 * trial ends, so everyone on a trial gets them, whatever their marketing
 * preferences, and they don't count toward the weekly cap.
 */

import type { Campaign, CampaignContext } from "./campaigns";
import type { UserFacts } from "./activation";

const SIGNOFF = process.env.LIFECYCLE_SIGNOFF || "- The Orbit team";

/** What happened in an owner's Orbit over the last 7 days, and what's coming up. */
export interface WeekSummary {
  newBookings: number;
  newClients: number;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  owedAmount: number;
  /** Confirmed appointments in the next 7 days. */
  upcoming: number;
  /** Booking requests still waiting for a yes or no. */
  requests: number;
}

/** Nothing worth a summary email. */
export function quietWeek(w: WeekSummary): boolean {
  return w.newBookings + w.newClients + w.paidCount + w.unpaidCount + w.upcoming + w.requests === 0;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function hasStarted(f: UserFacts): boolean {
  return f.clientCount + f.bookingCount + f.invoiceCount + f.serviceCount > 0;
}

/* ── Weekly tips: one a week, never repeated, only if it fits how they use Orbit ── */

export interface Tip {
  id: string;
  applies: (f: UserFacts) => boolean;
  subject: string;
  statement: string;
  body: string;
  steps?: { title: string; body?: string }[];
  cta: { text: string; path: string };
}

export const TIPS: Tip[] = [
  {
    id: "bio_link",
    applies: (f) => f.bookingLinkLive,
    subject: "Put your booking link where your clients already are",
    statement: "Your bio is a *booking button.*",
    body: "Most of your clients find you on Instagram, TikTok or WhatsApp. Put your Orbit booking link in your bio and status, and they can book without a single \"are you free Saturday?\" message.",
    steps: [
      { title: "Copy your link", body: "Booking link page → Copy." },
      { title: "Paste it in your bio", body: "Instagram, TikTok and your WhatsApp Business profile." },
      { title: "Say it in captions", body: "\"Book through the link in my bio.\"" },
    ],
    cta: { text: "Copy your booking link", path: "/booking-link" },
  },
  {
    id: "same_day_invoice",
    applies: (f) => f.clientCount > 0,
    subject: "The invoice that gets paid fastest",
    statement: "Send it *the same day.*",
    body: "Invoices sent on the day of the job get paid much faster than ones sent days later, while the work is fresh in your client's mind. Orbit can create one in under a minute, with a link they can pay from.",
    cta: { text: "Create an invoice", path: "/payments/new" },
  },
  {
    id: "payment_link",
    applies: (f) => f.invoiceCount > 0,
    subject: "Let clients pay you in two taps",
    statement: "Make paying you *the easy part.*",
    body: "Add a payment link to your invoice and your client can pay by card, bank transfer or USSD in seconds. The money goes straight to your bank, and Orbit marks the invoice paid for you. No more \"did you get my transfer?\".",
    cta: { text: "Open your invoices", path: "/payments" },
  },
  {
    id: "reminders",
    applies: (f) => f.bookingCount > 0 || f.bookingLinkLive,
    subject: "Fewer no-shows, zero extra work",
    statement: "Let Orbit *remind them.*",
    body: "Clients forget, not because they don't care, but because life is busy. Turn on appointment reminders and Orbit messages them before every booking, automatically.",
    cta: { text: "Turn on reminders", path: "/automations" },
  },
  {
    id: "birthdays",
    applies: (f) => f.clientCount > 0,
    subject: "The easiest way to bring a client back",
    statement: "Never miss *a birthday.*",
    body: "Add your clients' birthdays and Orbit reminds you on the day, with a warm message already written. It's a small thing clients remember, and a good reason for them to book again.",
    cta: { text: "Add a birthday", path: "/clients" },
  },
  {
    id: "reviews",
    applies: (f) => f.bookingCount > 0,
    subject: "Turn happy clients into new ones",
    statement: "Ask for the review *while they're smiling.*",
    body: "After an appointment, tap \"Ask for review\" on the client's page. Orbit sends them a link, and their review shows on your booking page, where new clients look before they book.",
    cta: { text: "Open your clients", path: "/clients" },
  },
  {
    id: "phone_app",
    applies: () => true,
    subject: "Put Orbit on your home screen",
    statement: "Orbit, *one tap away.*",
    body: "Add Orbit to your phone's home screen and it opens like an app, even with bad network. Turn on notifications and new bookings and payments pop up on your lock screen.",
    steps: [
      { title: "iPhone", body: "Open Orbit in Safari, tap Share, then Add to Home Screen." },
      { title: "Android", body: "Open Orbit in Chrome, tap ⋮, then Install app." },
      { title: "Then", body: "Open it from the new icon and turn on Phone notifications in Settings." },
    ],
    cta: { text: "Open Orbit", path: "/home" },
  },
  {
    id: "social_clients",
    applies: (f) => f.clientCount > 0,
    subject: "Clients from Instagram or TikTok? Save them too",
    statement: "No phone number? *No problem.*",
    body: "Add a client with just their Instagram or TikTok username. When you send them an invoice or a reminder, Orbit copies the message and opens their chat, so you just paste and send.",
    cta: { text: "Add a client", path: "/clients/new" },
  },
  {
    id: "insights",
    applies: (f) => f.paidInvoiceCount > 0 || f.bookingCount >= 3,
    subject: "Who are your best clients?",
    statement: "Your business, *in plain numbers.*",
    body: "Insights shows your busiest days, your best clients and how much you've made this month compared with last. It's the quickest way to see what's working.",
    cta: { text: "See your insights", path: "/analytics" },
  },
];

/** The next tip this owner hasn't had that fits what they use. */
export function nextTip(ctx: CampaignContext, userId: string): Tip | null {
  return TIPS.find((t) => t.applies(ctx.facts) && !ctx.sentKeys.has(`weekly_tip:${userId}:${t.id}`)) ?? null;
}

/* ── the campaigns ── */

function trialDate(ctx: CampaignContext): string {
  return ctx.trial ? new Date(ctx.trial.endsAt).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long" }) : "";
}

function trialEmail(ctx: CampaignContext, last: boolean) {
  const when = trialDate(ctx);
  return {
    preheader: last ? `Your Pro plan starts tomorrow, ${when}.` : `Your Pro plan starts on ${when}.`,
    eyebrow: "Orbit Pro trial",
    title: last ? "Last day of your Pro trial" : "Your Pro trial ends in 2 days",
    blocks: [
      { type: "statement" as const, text: last ? "Last day of *your trial.*" : "2 days left *of your trial.*" },
      {
        type: "text" as const,
        paragraphs: [
          `${ctx.firstName ? `${ctx.firstName}, your` : "Your"} free Orbit Pro trial ends on **${when}**. After that, your Pro plan starts and the card you added is charged for the plan you picked.`,
          "Want to keep Pro? You don't need to do anything.",
        ],
      },
      {
        type: "steps" as const,
        title: "What you keep with Pro",
        items: [
          { title: "Unlimited clients", body: "No 10-client limit." },
          { title: "Reminders and follow-ups on autopilot" },
          { title: "Lower Orbit Pay fees", body: "And insights on how your business is doing." },
        ],
      },
      {
        type: "cta" as const,
        text: "Open Orbit",
        url: ctx.url("/home"),
        secondary: { text: "Not for you? Cancel in Settings before then", url: ctx.url("/profile") },
      },
      { type: "text" as const, paragraphs: ["If you cancel, you won't be charged, and you keep everything on the free plan."] },
      { type: "signoff" as const, lines: ["Questions? Just reply to this email.", SIGNOFF] },
    ],
  };
}

export const RECURRING_CAMPAIGNS: Campaign[] = [
  // ── Pro trial: 2 days before, then on the last day ─────────────────────────
  {
    id: "trial_ending",
    priority: 130,
    category: "account",
    transactional: true,
    key: (u, ctx) => `trial_ending:${u}:${ctx.trial?.endsAt.slice(0, 10) ?? "none"}`,
    eligible: (ctx) => !!ctx.trial && ctx.trial.hoursLeft > 24 && ctx.trial.hoursLeft <= 48,
    goal: (f) => f.isPro,
    subject: () => "Your Orbit Pro trial ends in 2 days",
    content: (ctx) => trialEmail(ctx, false),
  },
  {
    id: "trial_last_day",
    priority: 131,
    category: "account",
    transactional: true,
    key: (u, ctx) => `trial_last_day:${u}:${ctx.trial?.endsAt.slice(0, 10) ?? "none"}`,
    eligible: (ctx) => !!ctx.trial && ctx.trial.hoursLeft > 0 && ctx.trial.hoursLeft <= 24,
    goal: (f) => f.isPro,
    subject: () => "Last day of your Orbit Pro trial",
    content: (ctx) => trialEmail(ctx, true),
  },

  // ── Weekly summary: Monday (or Tuesday if Monday's slot went to something else) ──
  {
    id: "weekly_summary",
    priority: 60,
    category: "weekly_summary",
    key: (u, ctx) => `weekly_summary:${u}:${ctx.local.weekStart}`,
    eligible: (ctx) =>
      (ctx.local.weekday === 1 ? ctx.local.hour >= 7 : ctx.local.weekday === 2)
      && ctx.daysInactive < 7 // drifting away: the come-back emails cover them instead
      && hasStarted(ctx.facts) && !quietWeek(ctx.week),
    goal: (f) => (f.lastActiveAt ? Date.now() - new Date(f.lastActiveAt).getTime() < 2 * 86_400_000 : false),
    subject: (ctx) => {
      const w = ctx.week;
      if (w.paidCount) return `You got paid ${ctx.money(w.paidAmount)} last week`;
      if (w.newBookings) return `${plural(w.newBookings, "new booking")} last week`;
      if (w.upcoming) return `${plural(w.upcoming, "appointment")} coming up this week`;
      return "Your week in Orbit";
    },
    content: (ctx) => {
      const w = ctx.week;
      const items: { icon: "booking" | "payment" | "invoice" | "reminder" | "client"; title: string; meta: string; time: string }[] = [];
      if (w.paidCount) items.push({ icon: "payment", title: `${ctx.money(w.paidAmount)} received`, meta: `${plural(w.paidCount, "invoice")} paid`, time: "Last 7 days" });
      if (w.newBookings) items.push({ icon: "booking", title: plural(w.newBookings, "new booking"), meta: "Booked in the last 7 days", time: "Last 7 days" });
      if (w.newClients) items.push({ icon: "client", title: plural(w.newClients, "new client"), meta: "Added to Orbit", time: "Last 7 days" });
      if (w.upcoming) items.push({ icon: "reminder", title: `${plural(w.upcoming, "appointment")} this week`, meta: "Already in your calendar", time: "Next 7 days" });
      if (w.requests) items.push({ icon: "booking", title: `${plural(w.requests, "booking request")} waiting`, meta: "Clients are waiting for your yes", time: "Now" });
      if (w.unpaidCount) items.push({ icon: "invoice", title: plural(w.unpaidCount, "unpaid invoice"), meta: w.owedAmount > 0 ? `${ctx.money(w.owedAmount)} still owed to you` : "Still waiting to be paid", time: "Now" });
      const cta = w.requests
        ? { text: "Answer booking requests", path: "/bookings" }
        : w.unpaidCount
          ? { text: "Chase unpaid invoices", path: "/payments" }
          : { text: "Open Orbit", path: "/home" };
      return {
        preheader: items.map((i) => i.title).join(" · "),
        eyebrow: "Your week",
        title: `Your week${ctx.businessName ? ` at ${ctx.businessName}` : ""}`,
        blocks: [
          { type: "statement", text: `Your week${ctx.businessName ? ` at *${ctx.businessName}.*` : " *in Orbit.*"}` },
          { type: "notifications", items },
          { type: "cta", text: cta.text, url: ctx.url(cta.path) },
          { type: "text", paragraphs: ["You get this every Monday. Turn it off any time under Settings → Email preferences."] },
          { type: "signoff", lines: [SIGNOFF] },
        ],
      };
    },
  },

  // ── Weekly tip: Thursday or Friday, once setup emails are done ──────────────
  {
    id: "weekly_tip",
    priority: 50,
    category: "tips",
    key: (u, ctx) => `weekly_tip:${u}:${nextTip(ctx, u)?.id ?? "none"}`,
    eligible: (ctx) =>
      (ctx.local.weekday === 4 || ctx.local.weekday === 5) && ctx.local.hour >= 10
      && ctx.daysSinceSignup >= 10
      && ctx.daysInactive < 7 // drifting away: the come-back emails cover them instead
      && (ctx.sent.get("weekly_tip") ?? Infinity) >= 6
      && !!nextTip(ctx, ctx.userId),
    goal: () => false,
    subject: (ctx) => nextTip(ctx, ctx.userId)!.subject,
    content: (ctx) => {
      const t = nextTip(ctx, ctx.userId)!;
      return {
        preheader: t.body.slice(0, 110),
        eyebrow: "Orbit tip",
        title: t.subject,
        blocks: [
          { type: "statement", text: t.statement },
          { type: "text", paragraphs: [t.body] },
          ...(t.steps ? [{ type: "steps" as const, title: "How", items: t.steps }] : []),
          { type: "cta", text: t.cta.text, url: ctx.url(t.cta.path) },
          { type: "signoff", lines: [SIGNOFF] },
        ],
      };
    },
  },
];
