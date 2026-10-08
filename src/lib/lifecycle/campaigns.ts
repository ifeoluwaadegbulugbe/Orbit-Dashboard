/**
 * Lifecycle campaigns (Phase 1: onboarding, activation, checkout recovery).
 *
 * Each campaign is a rule, not a timer: `eligible` is evaluated against what
 * the owner has ACTUALLY done every time the job runs, right before sending.
 * If they already did the thing, the email simply never qualifies. The
 * engine then picks the highest-priority eligible campaign, respects
 * preferences/suppression/frequency caps, and sends at most one.
 */

import { activation, ACTIVATION_STEPS, firstValueAchieved, type UserFacts } from "./activation";
import type { LifecycleContent } from "./render";

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
  content: (ctx: CampaignContext) => LifecycleContent;
}

/** Setup nudges only for owners in their first month - nobody gets onboarding mail a year in. */
const ONBOARDING_WINDOW_DAYS = 30;

const hi = (ctx: CampaignContext) => (ctx.firstName ? `Hi ${ctx.firstName},` : "Hi there,");
/** Set LIFECYCLE_SIGNOFF (e.g. "- Ife, founder of Orbit") to sign emails as a person. */
const SIGNOFF = process.env.LIFECYCLE_SIGNOFF || "- The Orbit team";

function onboarding(ctx: CampaignContext, fromDay: number) {
  return ctx.daysSinceSignup >= fromDay
    && ctx.daysSinceSignup <= ONBOARDING_WINDOW_DAYS
    && !firstValueAchieved(ctx.facts);
}

export const CAMPAIGNS: Campaign[] = [
  // ── 1. Welcome ──────────────────────────────────────────────────────────
  {
    id: "welcome",
    priority: 120,
    category: "tips",
    key: (u) => `welcome:${u}`,
    eligible: (ctx) => ctx.daysSinceSignup <= 3,
    goal: (f) => f.serviceCount > 0 || f.clientCount > 0,
    subject: (ctx) => (ctx.firstName ? `Welcome aboard, ${ctx.firstName} 🚀` : "Welcome aboard 🚀"),
    content: (ctx) => {
      const left = ACTIVATION_STEPS.filter((s) => !s.done(ctx.facts));
      const next = left[0];
      return {
        preheader: "Your business, in one calm little universe. Here's where to start.",
        kicker: "Welcome aboard",
        headline: "You're in orbit.",
        hero: "welcome",
        paragraphs: [
          `${ctx.firstName ? `Hey ${ctx.firstName} - ` : ""}Orbit keeps your clients, bookings and payments in one place${ctx.businessName ? ` for **${ctx.businessName}**` : ""}. Less admin, more doing the work you're actually good at.`,
          next
            ? "You don't need to set everything up today. Start with the first one - it takes about a minute."
            : "You've already nailed the basics. Have a wander around your dashboard.",
        ],
        section: left.length
          ? { title: "Your first moves:", note: `(${left.length} quick steps)`, items: left.slice(0, 3).map((s) => ({ title: s.label })) }
          : undefined,
        cta: next ? { text: next.action, url: ctx.url(next.href) } : { text: "Open Orbit", url: ctx.url("/home") },
        signoff: `Stuck? Just reply - a real person reads these.<br>${SIGNOFF}`,
      };
    },
  },

  // ── 2. First service (Day 1) ────────────────────────────────────────────
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
      kicker: "Setup · Step 1",
      headline: "What do you sell?",
      hero: "first_service",
      paragraphs: [
        `${hi(ctx)} add one service and Orbit uses it everywhere - bookings, invoices and your booking page. Type it once, never again.`,
      ],
      section: {
        title: "Takes about a minute:",
        items: [
          { title: "Name it", body: "\"Gel manicure\", \"Bridal makeup\", \"1-hour lesson\"." },
          { title: "Price it", body: "A number, \"from ₦5,000\", or \"Free\" - your call." },
          { title: "Time it", body: "Roughly how long it takes, so bookings don't clash." },
        ],
      },
      cta: { text: "Add your first service", url: ctx.url("/services") },
      signoff: SIGNOFF,
    }),
  },

  // ── 3. Booking link (Day 2) ─────────────────────────────────────────────
  {
    id: "booking_link",
    priority: 99,
    category: "tips",
    key: (u) => `booking_link:${u}`,
    eligible: (ctx) => onboarding(ctx, 2) && ctx.facts.serviceCount > 0 && !ctx.facts.bookingLinkLive,
    goal: (f) => f.bookingLinkLive,
    subject: () => "Let clients book you without the back-and-forth",
    content: (ctx) => ({
      preheader: "One link. Clients pick a time. You just confirm.",
      kicker: "Setup · Step 2",
      headline: "No more \"what time works?\"",
      hero: "booking_link",
      paragraphs: [
        `${hi(ctx)} your booking page lets clients pick a service and a time on their own - even at 2am. You just tap confirm.`,
      ],
      section: {
        title: "Go live in 3 taps:",
        items: [
          { title: "Pick your link name", body: "Something like glam-by-amaka." },
          { title: "Press Save", body: "Your page goes live instantly." },
          { title: "Share it everywhere", body: "Instagram bio, WhatsApp status - plus a QR code for your wall." },
        ],
      },
      cta: { text: "Set up your booking link", url: ctx.url("/booking-link") },
      signoff: SIGNOFF,
    }),
  },

  // ── 4. Add clients (Day 4) ──────────────────────────────────────────────
  {
    id: "add_clients",
    priority: 98,
    category: "tips",
    key: (u) => `add_clients:${u}`,
    eligible: (ctx) => onboarding(ctx, 4) && ctx.facts.clientCount === 0,
    goal: (f) => f.clientCount > 0,
    subject: () => "Let's get your first client into Orbit",
    content: (ctx) => ({
      preheader: "Who booked what, who paid, who owes - without scrolling WhatsApp.",
      kicker: "Setup · Step 3",
      headline: "Your people, one place.",
      hero: "add_clients",
      paragraphs: [
        `${hi(ctx)} add one regular - just a name and number. From then on Orbit quietly remembers everything about them for you.`,
      ],
      section: {
        title: "What Orbit remembers:",
        items: [
          { title: "Every booking", body: "Past and upcoming, in one tap." },
          { title: "What they've paid (and owe)", body: "No more awkward guesswork." },
          { title: "Little details", body: "Birthdays, preferences, notes - the stuff that keeps them coming back." },
        ],
      },
      cta: { text: "Add a client", url: ctx.url("/clients/new") },
      signoff: SIGNOFF,
    }),
  },

  // ── 5. First invoice (Day 6) ────────────────────────────────────────────
  {
    id: "first_invoice",
    priority: 97,
    category: "tips",
    key: (u) => `first_invoice:${u}`,
    eligible: (ctx) =>
      ctx.daysSinceSignup >= 6 && ctx.daysSinceSignup <= ONBOARDING_WINDOW_DAYS
      && ctx.facts.clientCount > 0 && ctx.facts.invoiceCount === 0,
    goal: (f) => f.invoiceCount > 0,
    subject: () => "Get paid without chasing payments",
    content: (ctx) => ({
      preheader: "A proper invoice in under a minute - and a link they can pay from.",
      kicker: "Get paid",
      headline: "Get paid, not ghosted.",
      hero: "first_invoice",
      paragraphs: [
        `${hi(ctx)} you've got ${ctx.facts.clientCount === 1 ? "a client" : `**${ctx.facts.clientCount} clients**`} in Orbit. Next time someone owes you, send a real invoice instead of a "hi, just checking in…" message.`,
      ],
      section: {
        title: "Here's the flow:",
        items: [
          { title: "Pick the client" },
          { title: "Add what they owe", body: "Line items optional - it's up to you." },
          { title: "Send it", body: "They get a clean PDF and a link to pay by card, transfer or USSD." },
        ],
      },
      cta: { text: "Create your first invoice", url: ctx.url("/payments/new") },
      signoff: SIGNOFF,
    }),
  },

  // ── 6. Finish setup (Day 9) ─────────────────────────────────────────────
  {
    id: "finish_setup",
    priority: 95,
    category: "tips",
    key: (u) => `finish_setup:${u}`,
    eligible: (ctx) => onboarding(ctx, 9) && !activation(ctx.facts).activated && activation(ctx.facts).doneCount > 0,
    goal: (f) => activation(f).activated,
    subject: () => "You're closer than you think",
    content: (ctx) => {
      const act = activation(ctx.facts);
      const next = ACTIVATION_STEPS.find((s) => !s.done(ctx.facts));
      return {
        preheader: `You're ${act.pct}% of the way there.`,
        kicker: `${act.pct}% done`,
        headline: "Almost there.",
        hero: "finish_setup",
        paragraphs: [
          `${hi(ctx)} you're **${act.pct}%** of the way to Orbit running the admin side of your business. Here's your checklist:`,
        ],
        section: {
          title: "Your setup:",
          note: `(${act.doneCount}/${act.total})`,
          items: ACTIVATION_STEPS.map((s) => ({ title: s.label, done: s.done(ctx.facts) })),
        },
        cta: { text: next ? next.action : "Open Orbit", url: ctx.url(next ? next.href : "/home") },
        signoff: SIGNOFF,
      };
    },
  },

  // ── 7. First payment ────────────────────────────────────────────────────
  {
    id: "first_payment",
    priority: 90,
    category: "tips",
    key: (u) => `first_payment:${u}`,
    eligible: (ctx) =>
      ctx.facts.paidInvoiceCount === 0 && ctx.facts.invoiceCount > 0
      && (ctx.oldestUnpaidInvoiceDays ?? 0) >= 2,
    goal: (f) => f.paidInvoiceCount > 0,
    subject: () => "Make it easy for clients to pay you",
    content: (ctx) => ({
      preheader: "A payment link does the chasing for you.",
      kicker: "Get paid",
      headline: "Let the link do the chasing.",
      hero: "first_payment",
      paragraphs: [
        `${hi(ctx)} your invoice is out there. Give your client the easiest possible way to pay it.`,
      ],
      section: {
        title: "Three taps:",
        items: [
          { title: "Open the invoice" },
          { title: "Tap Generate payment link" },
          { title: "Send it on WhatsApp", body: "They pay by card, transfer or USSD - Orbit marks it paid for you." },
        ],
      },
      cta: { text: "Open your invoices", url: ctx.url("/payments") },
      secondary: { text: "Got paid in cash? Mark it paid instead", url: ctx.url("/payments") },
      signoff: SIGNOFF,
    }),
  },

  // ── 8. Checkout abandoned ───────────────────────────────────────────────
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
    subject: () => "Still thinking about Orbit Pro?",
    content: (ctx) => ({
      preheader: "Your upgrade didn't go through - here's the link if you still want it.",
      kicker: "Orbit Pro",
      headline: "Still thinking it over?",
      hero: "checkout_abandoned",
      paragraphs: [
        `${hi(ctx)} looks like you started upgrading to Pro but didn't finish. No pressure at all - if the payment hiccuped, the button below picks up right where you left off.`,
      ],
      section: {
        title: "What Pro adds:",
        items: [
          { title: "Unlimited clients", body: "Grow past 10 without thinking about it." },
          { title: "Reminders on autopilot", body: "Follow-ups and payment nudges that send themselves." },
          { title: "The full picture", body: `Insights on how ${ctx.businessName ? `**${ctx.businessName}**` : "your business"} is really doing.` },
        ],
      },
      cta: { text: "Finish upgrading", url: ctx.url("/profile?upgrade=1") },
      signoff: `Questions first? Just reply.<br>${SIGNOFF}`,
    }),
  },
];
