/**
 * Orbit's five master email templates. Each one is a recipe of design-
 * system blocks with ONE dominant idea and one "Orbit moment" - a small
 * visual surprise (a sticker, a handwritten note, a cursor on "Paid").
 *
 * Templates take only real data. Where a card is illustrative (e.g. showing
 * what a client card looks like before the owner has any clients) the copy
 * says so ("This is what…") - nothing pretends to be the reader's data.
 */

import type { EmailContent } from "./render";

type Url = (path: string) => string;

// ── 1. Welcome - Layout 01 Big Statement + Layout 05 Before/After ─────────
export function welcomeEmail(p: {
  firstName: string | null;
  businessName: string | null;
  nextSteps: { title: string }[];
  cta: { text: string; path: string };
  signoff: string;
  url: Url;
}): EmailContent {
  return {
    preheader: "Run your business. Not the admin. Here's where to start.",
    eyebrow: "Welcome",
    title: "Welcome to Orbit",
    blocks: [
      { type: "statement", size: "xl", text: "Less admin. *More actual work.*", underline: false },
      {
        type: "text",
        paragraphs: [
          `${p.firstName ? `Hi ${p.firstName}. ` : ""}Right now the business side of ${p.businessName ? `**${p.businessName}**` : "your business"} probably lives in about five places. Orbit puts it in one.`,
        ],
      },
      {
        type: "beforeAfter",
        before: ["WhatsApp DMs", "Notes app", "Bank alerts", "Your memory"],
        after: ["Clients", "Bookings", "Invoices", "Reminders"],
      },
      ...(p.nextSteps.length
        ? [{ type: "steps" as const, title: "Start here", items: p.nextSteps.slice(0, 3).map((s, i) => ({ title: s.title, body: i === 0 ? "About a minute. Seriously." : undefined })) }]
        : []),
      { type: "cta", text: p.cta.text, url: p.url(p.cta.path) },
      { type: "signoff", lines: ["Stuck? Just reply - a real person reads these.", p.signoff] },
    ],
  };
}

// ── 2. Activation - Layout 07 Product + Doodle ─────────────────────────────
export function activationClientEmail(p: { firstName: string | null; signoff: string; url: Url }): EmailContent {
  return {
    preheader: "Their number, what they booked, what they owe - all on one card.",
    eyebrow: "Setup · Clients",
    title: "Let's get your first client into Orbit",
    blocks: [
      { type: "statement", text: "Still scrolling WhatsApp for *that one number?*" },
      {
        type: "text",
        paragraphs: [`${p.firstName ? `${p.firstName}, add` : "Add"} one regular - just a name and a phone number. This is what Orbit keeps for them after that:`],
      },
      {
        type: "card",
        annotation: "Yep, it's all here.",
        card: {
          kind: "client",
          name: "Amaka Johnson",
          detail: "Example client · 0803 000 0000",
          tag: "Regular",
          facts: [
            { label: "Next booking", value: "Sat 14 Oct · 11:00am" },
            { label: "Paid so far", value: "₦145,000" },
            { label: "Owes", value: "Nothing. Nice." },
            { label: "Birthday", value: "3 November" },
          ],
        },
      },
      { type: "cta", text: "Add your first client", url: p.url("/clients/new") },
      { type: "signoff", lines: [p.signoff] },
    ],
  };
}

// ── 3. Product education - Layout 02 Product Reveal ────────────────────────
export function bookingLinkEmail(p: { firstName: string | null; businessName: string | null; signoff: string; url: Url }): EmailContent {
  return {
    preheader: "One link. Clients pick a time. You just confirm.",
    eyebrow: "Setup · Booking link",
    title: "Let clients book themselves",
    blocks: [
      { type: "statement", text: "Your calendar called. It wants *fewer DMs.*" },
      {
        type: "text",
        paragraphs: [
          `${p.firstName ? `${p.firstName}, your` : "Your"} booking page lets clients pick a service and a time on their own - even at 2am. You just tap confirm. This is what lands in Orbit:`,
        ],
      },
      {
        type: "card",
        sticker: "You're booked.",
        card: { kind: "booking", service: "Gel manicure", client: "Example client", weekday: "SAT", day: "14", month: "Oct", time: "11:00am", status: "Confirmed" },
      },
      {
        type: "steps",
        title: "Live in three taps",
        items: [
          { title: "Pick your link name", body: p.businessName ? `Something like ${p.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.` : "Something short and memorable." },
          { title: "Press Save", body: "Your page goes live straight away." },
          { title: "Drop it everywhere", body: "Instagram bio, WhatsApp status - and there's a QR code for your wall." },
        ],
      },
      { type: "cta", text: "Set up your booking link", url: p.url("/booking-link") },
      { type: "signoff", lines: [p.signoff] },
    ],
  };
}

// ── 4. Payment / business notification - Layout 01 + Layout 04 ─────────────
export function paymentReceivedEmail(p: {
  amount: string;
  clientName: string;
  invoiceNumber: string | null;
  paymentPath: string;
  url: Url;
}): EmailContent {
  return {
    preheader: `${p.clientName} just paid ${p.amount}.`,
    eyebrow: "Payment",
    title: "Someone paid you",
    blocks: [
      { type: "statement", size: "xl", text: "Paid. *Finally.*" },
      { type: "text", paragraphs: [`**${p.clientName}** just paid${p.invoiceNumber ? ` invoice ${p.invoiceNumber}` : ""}. No chasing required.`] },
      { type: "card", cursor: true, card: { kind: "payment", amount: p.amount, client: p.clientName, note: p.invoiceNumber ? `Invoice ${p.invoiceNumber}` : undefined, status: "✓ Paid" } },
      { type: "cta", text: "See the payment", url: p.url(p.paymentPath) },
    ],
  };
}

// ── 5. Re-engagement - Layout 03 Editorial Story + Layout 04 Stack ─────────
export function reengagementEmail(p: {
  firstName: string | null;
  clientCount: number;
  daysAway: number;
  /** Real things waiting for them; omitted when there's nothing true to say. */
  waiting: { icon: "booking" | "payment" | "invoice" | "reminder" | "client"; title: string; meta: string; time: string }[];
  signoff: string;
  url: Url;
  /** "nudge" after a week away, "last" (the default) after three weeks. */
  variant?: "nudge" | "last";
}): EmailContent {
  const nudge = p.variant === "nudge";
  const hey = p.firstName ? `Hey ${p.firstName}. ` : "";
  const intro = nudge
    ? `${hey}Haven't seen you in Orbit for a week${p.waiting.length ? ", and a few things have piled up" : ""}. Two minutes now saves a scramble later.`
    : `${hey}${p.clientCount ? `You added **${p.clientCount} client${p.clientCount === 1 ? "" : "s"}**` : "You set up Orbit"} and then life got busy - we get it. It's been ${p.daysAway} days, and everything's exactly where you left it.`;
  return {
    preheader: nudge
      ? (p.waiting.length ? p.waiting.map((w) => w.title).slice(0, 2).join(" · ") : "Everything's where you left it.")
      : `${p.clientCount ? `${p.clientCount} clients` : "Your setup"}, right where you left ${p.clientCount ? "them" : "it"}.`,
    eyebrow: nudge ? "Quick check-in" : "It's been a minute",
    title: nudge ? "A few things are waiting" : "Your business is still here",
    blocks: [
      { type: "statement", text: nudge ? "Your Orbit missed you *a little.*" : "Your business is *still here.*" },
      { type: "text", paragraphs: [intro] },
      ...(p.waiting.length ? [{ type: "notifications" as const, items: p.waiting.slice(0, 4) }] : []),
      { type: "cta", text: nudge ? "See what's waiting" : "Pick up where you left off", url: p.url("/home") },
      { type: "signoff", lines: [nudge ? "Back to it." : "No pressure. Orbit will be here - this is the last nudge from us.", p.signoff] },
    ],
  };
}
