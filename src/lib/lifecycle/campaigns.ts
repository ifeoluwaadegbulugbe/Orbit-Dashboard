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
    subject: () => "Welcome to Orbit 👋",
    content: (ctx) => {
      const next = ACTIVATION_STEPS.find((s) => !s.done(ctx.facts));
      return {
        preheader: "One small step to get your business set up.",
        heading: ctx.firstName ? `Welcome, ${ctx.firstName}` : "Welcome to Orbit",
        paragraphs: [
          `Orbit keeps your clients, bookings and payments in one place${ctx.businessName ? ` for **${ctx.businessName}**` : ""}, so you spend less time on admin and more time on the work.`,
          next
            ? `The best place to start: **${next.action.toLowerCase()}**. It takes about a minute.`
            : "You've already done the setup basics - nice. Have a look around your dashboard.",
          "Reply to this email any time if you get stuck. A real person reads it.",
        ],
        cta: next ? { text: next.action, url: ctx.url(next.href) } : { text: "Open Orbit", url: ctx.url("/home") },
        signoff: SIGNOFF,
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
    subject: () => "Your first service is the easiest place to start",
    content: (ctx) => ({
      preheader: "Name, price, how long it takes. That's it.",
      heading: "Start with what you sell",
      paragraphs: [
        hi(ctx),
        "Add one service - a name, a price and roughly how long it takes. Once it's in, Orbit can use it for bookings, invoices and your booking page, so you never type it twice.",
        "Just one is enough to start. You can add the rest later.",
      ],
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
      preheader: "One link for your bio and WhatsApp status.",
      heading: "No more \"what time works for you?\"",
      paragraphs: [
        hi(ctx),
        "Your booking page lets clients pick a service and a time themselves. You just confirm.",
        "Pick a link name, press Save, and put it in your Instagram bio or WhatsApp status. You'll also get a QR code for your shop wall.",
      ],
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
      preheader: "Their number, their preferences, what they owe - all in one place.",
      heading: "Start keeping your clients in one place",
      paragraphs: [
        hi(ctx),
        "Add one regular client - just a name and phone number. From there Orbit remembers their bookings, what they've paid, what they owe and even their birthday.",
        "No more scrolling through WhatsApp to find who booked what.",
      ],
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
      preheader: "A proper invoice in under a minute.",
      heading: "Ready to get paid?",
      paragraphs: [
        hi(ctx),
        `You've got ${ctx.facts.clientCount === 1 ? "a client" : `${ctx.facts.clientCount} clients`} in Orbit. Next time one of them owes you, send an invoice from Orbit instead of a reminder message.`,
        "They get a clean PDF and a link to pay by card, transfer or USSD. Orbit keeps track of who's paid, so you don't have to.",
      ],
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
      const left = ACTIVATION_STEPS.filter((s) => !s.done(ctx.facts));
      const next = left[0];
      return {
        preheader: `${left.length} small step${left.length === 1 ? "" : "s"} left.`,
        heading: "You're closer than you think",
        paragraphs: [
          hi(ctx),
          `You're ${activation(ctx.facts).pct}% of the way to having Orbit run the admin side of your business. ${left.length === 1 ? "There's one thing left:" : "Here's what's left:"}`,
          ...left.map((s) => `• ${s.label}`),
          "Each one takes a couple of minutes.",
        ],
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
      heading: "Your invoice is out. Now let's get it paid.",
      paragraphs: [
        hi(ctx),
        "Open your invoice and tap **Generate payment link**. Send it on WhatsApp - your client can pay by card, bank transfer or USSD, and Orbit marks it paid automatically.",
        "Paid in cash or by direct transfer instead? Tap **Mark paid** so your numbers stay right.",
      ],
      cta: { text: "Open your invoices", url: ctx.url("/payments") },
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
      heading: "Your upgrade didn't finish",
      paragraphs: [
        hi(ctx),
        "Looks like you started upgrading to Pro but didn't finish. No pressure - if something went wrong with the payment, the link below picks up where you left off.",
        `Pro gives you unlimited clients, automatic reminders and follow-ups, and full insights into how ${ctx.businessName ? `**${ctx.businessName}**` : "your business"} is doing.`,
        "If you've got a question first, just reply.",
      ],
      cta: { text: "Finish upgrading", url: ctx.url("/profile?upgrade=1") },
      signoff: SIGNOFF,
    }),
  },
];
