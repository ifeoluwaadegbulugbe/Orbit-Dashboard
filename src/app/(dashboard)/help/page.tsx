// app/(dashboard)/help/page.tsx
//
// The help / guides page. Contains accordion sections that walk the user through
// setting up each payment provider, sending payment links, etc.
//
// What changed from the original:
//   - The "lemonsqueezy" section is replaced with a "stripe" section
//   - The QuickLink row at the top now says "Set up Stripe" instead of Lemon Squeezy
//   - All Flutterwave content is 100% unchanged
//   - FAQ answers updated where they mentioned Lemon Squeezy

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen, CreditCard, Link2, Receipt, MessageCircle, Search,
  ChevronDown, ExternalLink, Sparkles, ShieldCheck, AlertCircle,
  type LucideIcon,
} from "lucide-react";

// ─── Content model ───────────────────────────────────────────────────────────

interface GuideStep {
  title: string;
  body: React.ReactNode;
  note?: { tone: "info" | "warning"; text: React.ReactNode };
}

interface GuideSection {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  intro: string;
  steps: GuideStep[];
  cta?: { label: string; href: string; external?: boolean };
}

// ─── Guide content ───────────────────────────────────────────────────────────

const SECTIONS: GuideSection[] = [

  // ── Stripe (replaces Lemon Squeezy) ──────────────────────────────────────
  {
    id: "stripe",
    icon: CreditCard,
    iconColor: "#635BFF",
    iconBg: "#EEEDFE",
    title: "Set up Stripe",
    intro:
      "Best for accepting card payments from clients anywhere in the world. " +
      "Payouts settle to your own bank. Takes about 5 minutes the first time.",
    steps: [
      {
        title: "Create your Stripe account",
        body: (
          <>
            Go to{" "}
            <a
              href="https://dashboard.stripe.com/register"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-[var(--color-primary)]"
            >
              stripe.com/register
            </a>{" "}
            and sign up with your business email. Verify the email Stripe sends you.
          </>
        ),
      },
      {
        title: "Add your bank account for payouts",
        body: (
          <>
            Once logged in, Stripe will guide you through activating your account.
            Click <strong>Settings → Payouts</strong> and add your bank account details.
            Stripe deposits your earnings here automatically — usually within 2 business days.
          </>
        ),
        note: {
          tone: "info",
          text: "You can test Stripe without a bank account using test mode (sk_test_ keys). Real payouts require account activation, which usually takes 1–2 days.",
        },
      },
      {
        title: "Get your API key",
        body: (
          <>
            In your Stripe dashboard, click{" "}
            <strong>Developers → API keys</strong>. You&apos;ll see two keys:
            a <em>Publishable key</em> and a <em>Secret key</em>.
            <br /><br />
            Orbit only needs the <strong>Secret key</strong> — click{" "}
            <strong>Reveal live key</strong> (or use a test key to try things first).
            Copy the full string — it starts with{" "}
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">
              sk_live_
            </code>{" "}
            or{" "}
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">
              sk_test_
            </code>
            .
          </>
        ),
        note: {
          tone: "warning",
          text: "The secret key is shown once when you reveal it. Keep the Stripe tab open until you've pasted it into Orbit.",
        },
      },
      {
        title: "Connect Orbit",
        body: (
          <>
            Open{" "}
            <Link
              href="/payment-settings"
              className="underline font-semibold text-[var(--color-primary)]"
            >
              Online Payments
            </Link>{" "}
            in Orbit, click <strong>Get started</strong> on the Stripe card, and paste
            your secret key when the wizard asks. Orbit will verify it against Stripe and
            confirm the connection — all in about 30 seconds.
          </>
        ),
      },
      {
        title: "Set up your webhook (for automatic payment confirmation)",
        body: (
          <>
            For Orbit to mark invoices as <strong>Paid</strong> automatically when a client
            pays, you need to register a webhook. In your Stripe dashboard:
            <ol className="mt-2 ml-4 space-y-1 list-decimal">
              <li>Go to <strong>Developers → Webhooks</strong></li>
              <li>Click <strong>Add endpoint</strong></li>
              <li>
                Enter your Orbit URL:{" "}
                <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">
                  https://YOUR-DOMAIN.com/api/webhooks/stripe
                </code>
              </li>
              <li>
                Under &ldquo;Events to listen to&rdquo;, add:{" "}
                <code className="text-tiny font-mono">payment_link.completed</code>,{" "}
                <code className="text-tiny font-mono">checkout.session.completed</code>,{" "}
                <code className="text-tiny font-mono">payment_intent.succeeded</code>
              </li>
              <li>Save — Stripe shows you a <strong>Signing secret</strong> (starts with <code className="text-tiny font-mono">whsec_</code>). Add it to your server&apos;s environment variables as <code className="text-tiny font-mono">STRIPE_WEBHOOK_SECRET</code>.</li>
            </ol>
          </>
        ),
        note: {
          tone: "info",
          text: "Without the webhook, you can still manually mark invoices as paid in Orbit. The webhook just makes it happen automatically.",
        },
      },
    ],
    cta: {
      label: "Open my Stripe dashboard",
      href: "https://dashboard.stripe.com",
      external: true,
    },
  },

  // ── Flutterwave (UNCHANGED from original) ────────────────────────────────
  {
    id: "flutterwave",
    icon: CreditCard,
    iconColor: "#F5A623",
    iconBg: "#FFF1DC",
    title: "Set up Flutterwave",
    intro:
      "Best choice if you're based in Nigeria or anywhere across Africa. " +
      "Accepts cards, mobile money, bank transfers, and USSD. Payouts settle to a local bank.",
    steps: [
      {
        title: "Create your Flutterwave account",
        body: (
          <>
            Sign up at{" "}
            <a
              href="https://dashboard.flutterwave.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-[var(--color-primary)]"
            >
              flutterwave.com
            </a>{" "}
            using your business email. Verify the email.
          </>
        ),
      },
      {
        title: "Complete your profile and KYC",
        body: (
          <>
            Once logged in, fill in your business profile (name, type, address) and submit
            your KYC documents (your government ID and a business document if you have one).
            KYC is required before you can receive real payouts.{" "}
            <strong>Test mode works immediately</strong> — you can plug your keys into Orbit
            right away while KYC processes.
          </>
        ),
        note: {
          tone: "info",
          text: "KYC usually takes 1–3 business days. You can build and test everything in the meantime.",
        },
      },
      {
        title: "Add your settlement bank",
        body: (
          <>
            Click <strong>Settings → Settlement Account</strong> and add the bank account
            where you want customer payments deposited. Flutterwave will verify it.
          </>
        ),
      },
      {
        title: "Grab your API keys",
        body: (
          <>
            Click <strong>Settings</strong> (bottom left) → <strong>API</strong> tab.
            You&apos;ll see two values:
            <ul className="mt-2 ml-4 space-y-1 list-disc">
              <li>
                <strong>Secret Key</strong> (click the eye to reveal it). Starts with{" "}
                <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">
                  FLWSECK_TEST-
                </code>{" "}
                in test mode.
              </li>
              <li>
                <strong>Public Key</strong>. Starts with{" "}
                <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">
                  FLWPUBK_TEST-
                </code>
                .
              </li>
            </ul>
            Copy both. Don&apos;t share the secret key.
          </>
        ),
      },
      {
        title: "Connect Orbit",
        body: (
          <>
            Open{" "}
            <Link
              href="/payment-settings"
              className="underline font-semibold text-[var(--color-primary)]"
            >
              Online Payments
            </Link>{" "}
            in Orbit, click <strong>Get started</strong> on the Flutterwave card, and paste
            the secret and public keys when the wizard asks. Done — Orbit can now create
            payment links on your Flutterwave account.
          </>
        ),
      },
    ],
    cta: {
      label: "Open my Flutterwave dashboard",
      href: "https://dashboard.flutterwave.com",
      external: true,
    },
  },

  // ── Sending payment links (UNCHANGED from original) ──────────────────────
  {
    id: "send-link",
    icon: Link2,
    iconColor: "#E8557A",
    iconBg: "#FAEDF1",
    title: "Send your first payment link",
    intro:
      "Once your payment provider is connected, you can generate a payment link for any invoice " +
      "and send it to your client — they click, pay, and you get notified.",
    steps: [
      {
        title: "Open the invoice",
        body: (
          <>
            Go to <Link href="/payments" className="underline font-semibold text-[var(--color-primary)]">Payments</Link>,
            find the invoice you want to collect, and click it to open the detail view.
          </>
        ),
      },
      {
        title: "Generate the payment link",
        body: (
          <>
            On the invoice detail page, click <strong>Send payment link</strong>.
            Orbit creates a hosted checkout page on your provider&apos;s platform
            (Stripe or Flutterwave) — your client lands on that page and pays securely.
            No card details pass through Orbit.
          </>
        ),
      },
      {
        title: "Copy and send the link",
        body: (
          <>
            Once generated, copy the link and paste it wherever you communicate with your client —
            WhatsApp, email, SMS, Instagram DMs. The link works on any device and doesn&apos;t expire.
          </>
        ),
      },
      {
        title: "Watch it arrive",
        body: (
          <>
            When your client pays, Orbit updates the invoice status to{" "}
            <strong>Paid</strong> automatically (if you&apos;ve set up the webhook) or you
            can mark it manually. You&apos;ll see the payment in your dashboard straight away.
          </>
        ),
      },
    ],
  },

  // ── Invoices (UNCHANGED from original) ───────────────────────────────────
  {
    id: "invoices",
    icon: Receipt,
    iconColor: "#0EA5E9",
    iconBg: "#E0F2FE",
    title: "Creating and managing invoices",
    intro:
      "Orbit lets you log any payment or create a formal invoice. Here's how to stay on top of " +
      "what you're owed.",
    steps: [
      {
        title: "Create a new invoice",
        body: (
          <>
            Click <Link href="/payments/new" className="underline font-semibold text-[var(--color-primary)]">New invoice</Link> from
            the Payments page. Fill in the client name, amount, and due date. The invoice number
            is auto-generated but you can edit it.
          </>
        ),
      },
      {
        title: "Understand invoice statuses",
        body: (
          <>
            <ul className="mt-1 ml-4 space-y-1 list-disc">
              <li><strong>Pending</strong> — created, not yet paid</li>
              <li><strong>Overdue</strong> — past the due date and still unpaid</li>
              <li><strong>Partial</strong> — client paid part of the amount</li>
              <li><strong>Paid</strong> — fully settled</li>
              <li><strong>Failed</strong> — payment was attempted but declined</li>
            </ul>
          </>
        ),
      },
      {
        title: "Mark an invoice as paid manually",
        body: (
          <>
            Open the invoice and click <strong>Mark as paid</strong>. Use this when
            a client pays you by cash or bank transfer outside of Orbit&apos;s payment links.
          </>
        ),
      },
    ],
  },
];

// ─── FAQs ─────────────────────────────────────────────────────────────────────

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Does Orbit take a cut of my payments?",
    a: "No. When a client pays via a Stripe or Flutterwave link, the money goes directly to your provider account. Orbit doesn't touch it. Your provider charges their own processing fee (Stripe: ~2.9% + 30¢ per transaction for cards; Flutterwave fees vary by country).",
  },
  {
    q: "Can I use both Stripe and Flutterwave?",
    a: "Not at the same time — Orbit connects one provider per account. You can switch by disconnecting the current one and connecting another. All historical invoices stay in your dashboard regardless of which provider created them.",
  },
  {
    q: "Are my API keys safe?",
    a: "Yes. Your keys are stored only in your browser's localStorage — they never leave your device to Orbit's servers. When you create a payment link, your browser sends the key directly to our API route, which uses it once and discards it. We don't log or store keys.",
  },
  {
    q: "What happens if a client's payment fails?",
    a: "The invoice status changes to 'Failed' automatically (if webhooks are set up). You can resend the payment link or ask the client to try a different card.",
  },
  {
    q: "Can I invoice in my local currency?",
    a: "Yes. Orbit uses your account's currency setting for all amounts. Stripe supports 135+ currencies. Flutterwave supports NGN, GHS, KES, ZAR, UGX, TZS, and more.",
  },
  {
    q: "Do I need a business registration to use Stripe?",
    a: "Not necessarily — individuals (sole traders / freelancers) can use Stripe with just a personal ID. Flutterwave may require a business registration in some African countries. Check each provider's requirements during account setup.",
  },
];

// ─── Page component ───────────────────────────────────────────────────────────

export default function HelpPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openFaq,     setOpenFaq]     = useState<number | null>(null);
  const [query,       setQuery]       = useState("");

  const filteredSections = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.intro.toLowerCase().includes(q) ||
        s.steps.some((step) => step.title.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Page heading */}
      <div>
        <h1 className="text-page font-bold">Help &amp; guides</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          Everything you need to set up payments and get paid.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the guides..."
          className="w-full h-12 pl-11 pr-4 rounded-full bg-white border border-[var(--color-border)] text-body placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
        />
      </div>

      {/* Quick links */}
      <div id="payments" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickLink
          icon={CreditCard}
          color="#635BFF"
          label="Set up Stripe"
          onClick={() => {
            setOpenSection("stripe");
            document.getElementById("section-stripe")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <QuickLink
          icon={CreditCard}
          color="#F5A623"
          label="Set up Flutterwave"
          onClick={() => {
            setOpenSection("flutterwave");
            document.getElementById("section-flutterwave")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <QuickLink
          icon={Link2}
          color="#E8557A"
          label="Send a payment link"
          onClick={() => {
            setOpenSection("send-link");
            document.getElementById("section-send-link")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>

      {/* Accordion sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden"
            >
              <button
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className="w-full p-6 sm:p-7 flex items-start gap-4 text-left hover:bg-[var(--color-canvas)] transition-colors"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: section.iconBg }}
                >
                  <Icon className="h-6 w-6" style={{ color: section.iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-card-title font-bold">{section.title}</h2>
                  <p className="text-small text-[var(--color-ink-light)] mt-1 leading-relaxed">
                    {section.intro}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-[var(--color-muted)] flex-shrink-0 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-[var(--color-border)] p-6 sm:p-7 space-y-5">
                  {section.steps.map((step, i) => (
                    <Step key={i} index={i} step={step} accentColor={section.iconColor} />
                  ))}
                  {section.cta && (
                    <a
                      href={section.cta.href}
                      target={section.cta.external ? "_blank" : undefined}
                      rel={section.cta.external ? "noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-small font-bold text-white shadow-soft transition-all hover:-translate-y-px"
                      style={{ backgroundColor: section.iconColor }}
                    >
                      {section.cta.label}
                      {section.cta.external && <ExternalLink className="h-3.5 w-3.5" />}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="pt-6">
        <div className="flex items-center gap-2 mb-5">
          <MessageCircle className="h-5 w-5 text-[var(--color-primary)]" />
          <h2 className="text-section font-bold">Common questions</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={i}
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-[var(--color-canvas)] transition-colors"
                >
                  <span className="flex-1 text-body font-semibold">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--color-muted)] transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-body text-[var(--color-ink-mid)] leading-relaxed border-t border-[var(--color-border)] pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="flex items-center gap-4 px-6 py-5 rounded-[var(--radius-2xl)] bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20">
        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body font-bold text-[var(--color-ink)]">Ready to connect?</div>
          <div className="text-small text-[var(--color-ink-mid)] mt-0.5">
            Head to Online Payments and pick the provider that fits your business.
          </div>
        </div>
        <Link
          href="/payment-settings"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Go to Online Payments
        </Link>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function QuickLink({
  icon: Icon, color, label, onClick,
}: { icon: LucideIcon; color: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-5 py-4 bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-soft-sm hover:shadow-soft hover:-translate-y-px transition-all text-left"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <span className="text-small font-semibold flex-1">{label}</span>
    </button>
  );
}

function Step({
  index, step, accentColor,
}: { index: number; step: GuideStep; accentColor: string }) {
  return (
    <div className="flex gap-4">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-small font-bold text-white"
        style={{ backgroundColor: accentColor }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <h3 className="text-body font-semibold text-[var(--color-ink)] mb-2">
          {step.title}
        </h3>
        <div className="text-small text-[var(--color-ink-mid)] leading-relaxed">
          {step.body}
        </div>
        {step.note && (
          <div
            className={`mt-3 flex items-start gap-2.5 px-4 py-3 rounded-[var(--radius-md)] text-small leading-relaxed ${
              step.note.tone === "warning"
                ? "bg-[var(--color-warning-light)] text-[var(--color-warning-deep)]"
                : "bg-[var(--color-primary-subtle)] text-[var(--color-ink-mid)]"
            }`}
          >
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>{step.note.text}</div>
          </div>
        )}
      </div>
    </div>
  );
}
