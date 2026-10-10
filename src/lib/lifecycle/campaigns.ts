/**
 * Lifecycle campaigns: onboarding, activation, checkout recovery, win-back.
 *
 * Each campaign is a rule, not a timer: `eligible` is evaluated against what
 * the owner has ACTUALLY done every time the job runs, right before sending.
 * If they already did the thing, the email simply never qualifies. The
 * engine then picks the highest-priority eligible campaign, respects
 * preferences/suppression/frequency caps, and sends at most one.
 */

import { activation, ACTIVATION_STEPS, daysSince, firstValueAchieved, type UserFacts } from "./activation";
import type { EmailContent } from "@/lib/email-design/render";
import { welcomeEmail, activationClientEmail, bookingLinkEmail, reengagementEmail } from "@/lib/email-design/templates";

/** Matches the email_preferences columns. */
export type EmailCategory = "tips" | "product_updates" | "promotions";

export interface CampaignContext {
  facts: UserFacts;
  firstName: string | null;
  businessName: string | null;
  daysSinceSignup: number;
  /** Oldest unpaid invoice's age in days, if any. */
  oldestUnpaidInvoiceDays: number | null;
  /** Most recent checkout_started event, if any. */
  lastCheckout: { id: number; hoursAgo: number } | null;
  /** Campaign ids already sent to this user, with days since. */
  sent: Map<string, number>;
  /** Builds an absolute app URL. */
  url: (path: string) => string;
  /** Last sign of life (app open or anything created), else signup. */
  inactiveSince: string;
  daysInactive: number;
  /** Real things waiting in their Orbit right now. */
  waiting: WaitingItem[];
}

export interface WaitingItem {
  icon: "booking" | "payment" | "invoice" | "reminder" | "client";
  title: string;
  meta: string;
  time: string;
}

export interface Campaign {
  id: string;
  /** Higher wins when several qualify in the same run. */
  priority: number;
  category: EmailCategory;
  /** Unique per user (and per occurrence where a campaign can repeat). */
  key: (userId: string, ctx: CampaignContext) => string;
  eligible: (ctx: CampaignContext) => boolean;
  /** The product action this email is trying to cause - used for conversion tracking. */
  goal: (f: UserFacts) => boolean;
  subject: (ctx: CampaignContext) => string;
  content: (ctx: CampaignContext) => EmailContent;
}

/** Setup nudges only for owners in their first month - nobody gets onboarding mail a year in. */
const ONBOARDING_WINDOW_DAYS = 30;

/** Set LIFECYCLE_SIGNOFF (e.g. "- Ife, founder of Orbit") to sign emails as a person. */
const SIGNOFF = process.env.LIFECYCLE_SIGNOFF || "- The Orbit team";

function onboarding(ctx: CampaignContext, fromDay: number) {
  return ctx.daysSinceSignup >= fromDay
    && ctx.daysSinceSignup <= ONBOARDING_WINDOW_DAYS
    && !firstValueAchieved(ctx.facts);
}

export const CAMPAIGNS: Campaign[] = [
  // ── 1. Welcome (master template 1) ──────────────────────────────────────
  {
    id: "welcome",
    priority: 120,
    category: "tips",
    key: (u) => `welcome:${u}`,
    eligible: (ctx) => ctx.daysSinceSignup <= 3,
    goal: (f) => f.serviceCount > 0 || f.clientCount > 0,
    subject: () => "Welcome to Orbit ✦",
    content: (ctx) => {
      const left = ACTIVATION_STEPS.filter((s) => !s.done(ctx.facts));
      const next = left[0];
      return welcomeEmail({
        firstName: ctx.firstName,
        businessName: ctx.businessName,
        nextSteps: left.map((s) => ({ title: s.label })),
        cta: next ? { text: next.action, path: next.href } : { text: "Open Orbit", path: "/home" },
        signoff: SIGNOFF,
        url: ctx.url,
      });
    },
  },

  // ── 2. First service (Day 1) - Layout 06 Single Feature ─────────────────
  {
    id: "first_service",
    priority: 100,
    category: "tips",
    key: (u) => `first_service:${u}`,
    eligible: (ctx) => onboarding(ctx, 1) && ctx.facts.serviceCount === 0,
    goal: (f) => f.serviceCount > 0,
    subject: () => "Quick one: what do you sell?",
    content: (ctx) => ({
      preheader: "Name, price, how long it takes. That's the whole job.",
      eyebrow: "Setup · Services",
      title: "Add your first service",
      blocks: [
        { type: "statement", text: "Type it once. *Never again.*" },
        { type: "text", paragraphs: [`${ctx.firstName ? `${ctx.firstName}, add` : "Add"} one service and Orbit reuses it everywhere - bookings, invoices, your booking page. No more retyping "Knotless braids, medium, ₦35k" into every chat.`] },
        {
          type: "steps",
          title: "About a minute",
          items: [
            { title: "Name it", body: "\"Gel manicure\", \"Bridal makeup\", \"1-hour session\"." },
            { title: "Price it", body: "A number, \"from ₦5,000\", or \"Free\". Your call." },
            { title: "Time it", body: "Roughly how long, so bookings never clash." },
          ],
        },
        { type: "cta", text: "Add your first service", url: ctx.url("/services") },
        { type: "signoff", lines: [SIGNOFF] },
      ],
    }),
  },

  // ── 3. Booking link (Day 2) - master template 3 ─────────────────────────
  {
    id: "booking_link",
    priority: 99,
    category: "tips",
    key: (u) => `booking_link:${u}`,
    eligible: (ctx) => onboarding(ctx, 2) && ctx.facts.serviceCount > 0 && !ctx.facts.bookingLinkLive,
    goal: (f) => f.bookingLinkLive,
    subject: () => "Let clients book you without the back-and-forth",
    content: (ctx) => bookingLinkEmail({ firstName: ctx.firstName, businessName: ctx.businessName, signoff: SIGNOFF, url: ctx.url }),
  },

  // ── 4. Add clients (Day 4) - master template 2 ──────────────────────────
  {
    id: "add_clients",
    priority: 98,
    category: "tips",
    key: (u) => `add_clients:${u}`,
    eligible: (ctx) => onboarding(ctx, 4) && ctx.facts.clientCount === 0,
    goal: (f) => f.clientCount > 0,
    subject: () => "Let's get your first client into Orbit",
    content: (ctx) => activationClientEmail({ firstName: ctx.firstName, signoff: SIGNOFF, url: ctx.url }),
  },

  // ── 5. First invoice (Day 6) - Layout 02 Product Reveal ─────────────────
  {
    id: "first_invoice",
    priority: 97,
    category: "tips",
    key: (u) => `first_invoice:${u}`,
    eligible: (ctx) =>
      ctx.daysSinceSignup >= 6 && ctx.daysSinceSignup <= ONBOARDING_WINDOW_DAYS
      && ctx.facts.clientCount > 0 && ctx.facts.invoiceCount === 0,
    goal: (f) => f.invoiceCount > 0,
    subject: () => "Someone still owes you money",
    content: (ctx) => ({
      preheader: "A proper invoice in under a minute - with a link they can pay from.",
      eyebrow: "Get paid",
      title: "Create your first invoice",
      blocks: [
        { type: "statement", text: "Someone *still* owes you money." },
        { type: "text", paragraphs: [`You've got ${ctx.facts.clientCount === 1 ? "a client" : `**${ctx.facts.clientCount} clients**`} in Orbit. Next time someone owes you, skip the "hi, just checking in…" message. Send this instead:`] },
        {
          type: "card",
          annotation: "Looks like you mean business.",
          card: { kind: "invoice", number: "INV-0001", client: "Example client", lines: [{ label: "Knotless braids (medium)", amount: "₦35,000" }, { label: "Wash & treatment", amount: "₦8,000" }], total: "₦43,000", status: "Due" },
        },
        { type: "text", paragraphs: ["They get a clean PDF and a link to pay by card, transfer or USSD. Orbit keeps track of who's paid - not you."] },
        { type: "cta", text: "Create your first invoice", url: ctx.url("/payments/new") },
        { type: "signoff", lines: [SIGNOFF] },
      ],
    }),
  },

  // ── 6. Finish setup (Day 9) - checklist + data viz ──────────────────────
  {
    id: "finish_setup",
    priority: 95,
    category: "tips",
    key: (u) => `finish_setup:${u}`,
    eligible: (ctx) => onboarding(ctx, 9) && !activation(ctx.facts).activated && activation(ctx.facts).doneCount > 0,
    goal: (f) => activation(f).activated,
    subject: () => "Okay, this is getting organized",
    content: (ctx) => {
      const act = activation(ctx.facts);
      const next = ACTIVATION_STEPS.find((s) => !s.done(ctx.facts));
      return {
        preheader: `You're ${act.pct}% set up.`,
        eyebrow: `${act.pct}% set up`,
        title: "You're closer than you think",
        blocks: [
          { type: "statement", text: "Okay, this is getting *organized.*" },
          { type: "text", paragraphs: [`${ctx.firstName ? `${ctx.firstName}, you're` : "You're"} **${act.doneCount} of ${act.total}** steps into getting the admin off your plate. Here's what's left:`] },
          { type: "checklist", title: "Your setup", items: ACTIVATION_STEPS.map((s) => ({ title: s.label, done: s.done(ctx.facts) })) },
          { type: "cta", text: next ? next.action : "Open Orbit", url: ctx.url(next ? next.href : "/home") },
          { type: "signoff", lines: [SIGNOFF] },
        ],
      };
    },
  },

  // ── 7. First payment - Layout 06 Single Feature ─────────────────────────
  {
    id: "first_payment",
    priority: 90,
    category: "tips",
    key: (u) => `first_payment:${u}`,
    eligible: (ctx) =>
      ctx.facts.paidInvoiceCount === 0 && ctx.facts.invoiceCount > 0
      && (ctx.oldestUnpaidInvoiceDays ?? 0) >= 2,
    goal: (f) => f.paidInvoiceCount > 0,
    subject: () => "Orbit can chase it. You don't have to.",
    content: (ctx) => ({
      preheader: "A payment link does the chasing for you.",
      eyebrow: "Get paid",
      title: "Make it easy to pay you",
      blocks: [
        { type: "statement", text: "Let the link do *the chasing.*" },
        { type: "text", paragraphs: [`${ctx.firstName ? `${ctx.firstName}, your` : "Your"} invoice is out there. Give your client the easiest possible way to pay it.`] },
        {
          type: "steps",
          title: "Three taps",
          items: [
            { title: "Open the invoice" },
            { title: "Tap **Generate payment link**" },
            { title: "Send it on WhatsApp", body: "Card, transfer or USSD - Orbit marks it paid for you." },
          ],
        },
        { type: "cta", text: "Open your invoices", url: ctx.url("/payments"), secondary: { text: "Paid in cash? Mark it paid instead", url: ctx.url("/payments") } },
        { type: "signoff", lines: [SIGNOFF] },
      ],
    }),
  },

  // ── 8. Checkout abandoned - Layout 08 Minimal Announcement ──────────────
  {
    id: "checkout_abandoned",
    priority: 105,
    category: "promotions",
    key: (u, ctx) => `checkout_abandoned:${u}:${ctx.lastCheckout?.id ?? "none"}`,
    eligible: (ctx) =>
      !ctx.facts.isPro
      && !!ctx.lastCheckout && ctx.lastCheckout.hoursAgo >= 2 && ctx.lastCheckout.hoursAgo <= 48
      // at most one checkout reminder a fortnight, however many times they open checkout
      && (ctx.sent.get("checkout_abandoned") ?? Infinity) > 14,
    goal: (f) => f.isPro,
    subject: () => "Ready for a little more Orbit?",
    content: (ctx) => ({
      preheader: "Your upgrade didn't go through - here's the link if you still want it.",
      eyebrow: "Orbit Pro",
      title: "Still thinking about Orbit Pro?",
      blocks: [
        { type: "statement", size: "xl", text: "Ready for a little *more Orbit?*" },
        { type: "text", paragraphs: [`${ctx.firstName ? `${ctx.firstName}, looks` : "Looks"} like your upgrade didn't quite finish. No pressure - if the payment hiccuped, the button below picks up where you left off.`] },
        {
          type: "steps",
          title: "What Pro adds",
          items: [
            { title: "Unlimited clients", body: "Grow past 10 without thinking about it." },
            { title: "Reminders on autopilot", body: "Follow-ups and payment nudges that send themselves." },
            { title: "The full picture", body: `How ${ctx.businessName ? `**${ctx.businessName}**` : "your business"} is really doing, in plain numbers.` },
          ],
        },
        { type: "cta", text: "Finish upgrading", url: ctx.url("/profile?upgrade=1") },
        { type: "signoff", lines: ["Questions first? Just reply.", SIGNOFF] },
      ],
    }),
  },

  // ── 9 & 10. Win-back - master template 5 (Re-engagement) ─────────────────
  // One gentle nudge after a week away, one last one after three weeks, then
  // silence. Both are keyed to this "spell" away (the day they were last
  // seen), so someone who comes back and drifts off again months later can
  // get them again - but never twice for the same absence.
  {
    id: "winback_7",
    priority: 70,
    category: "tips",
    key: (u, ctx) => `winback_7:${u}:${ctx.inactiveSince.slice(0, 10)}`,
    eligible: (ctx) => ctx.daysInactive >= 7 && ctx.daysInactive < 21 && hasStarted(ctx),
    goal: (f) => (daysSince(f.lastActiveAt) ?? Infinity) < 2,
    subject: (ctx) => ctx.waiting.length ? "A few things are waiting for you in Orbit" : "Quick check-in from Orbit",
    content: (ctx) => reengagementEmail({ ...winbackParams(ctx), variant: "nudge" }),
  },
  {
    id: "winback_21",
    priority: 71,
    category: "tips",
    key: (u, ctx) => `winback_21:${u}:${ctx.inactiveSince.slice(0, 10)}`,
    eligible: (ctx) => ctx.daysInactive >= 21 && hasStarted(ctx),
    goal: (f) => (daysSince(f.lastActiveAt) ?? Infinity) < 2,
    subject: () => "Your business is still here",
    content: (ctx) => reengagementEmail({ ...winbackParams(ctx), variant: "last" }),
  },
];

/** Win-back is for people who actually used Orbit; brand-new sign-ups get the onboarding emails instead. */
function hasStarted(ctx: CampaignContext): boolean {
  const f = ctx.facts;
  return f.clientCount + f.bookingCount + f.invoiceCount + f.serviceCount > 0;
}

function winbackParams(ctx: CampaignContext) {
  return {
    firstName: ctx.firstName,
    clientCount: ctx.facts.clientCount,
    daysAway: ctx.daysInactive,
    waiting: ctx.waiting,
    signoff: SIGNOFF,
    url: ctx.url,
  };
}
