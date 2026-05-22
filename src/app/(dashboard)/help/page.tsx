"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen, CreditCard, Link2, Receipt, MessageCircle, Search,
  ChevronDown, ExternalLink, Sparkles, ShieldCheck, AlertCircle,
  type LucideIcon,
} from "lucide-react";

// ─── Content model ─────────────────────────────────────────────────────────

interface GuideStep {
  title: string;
  body: React.ReactNode;
  /** Optional callout shown under the step body. */
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
  /** Final CTA shown after the steps. */
  cta?: { label: string; href: string; external?: boolean };
}

const SECTIONS: GuideSection[] = [
  // ── Lemon Squeezy ──
  {
    id: "lemonsqueezy",
    icon: CreditCard,
    iconColor: "#FFC233",
    iconBg: "#FFF8DD",
    title: "Set up Lemon Squeezy",
    intro:
      "Lemon Squeezy is the easiest way to accept card payments globally. Your payouts settle to your own bank. Takes about 10 minutes the first time.",
    steps: [
      {
        title: "Create your Lemon Squeezy account",
        body: (
          <>
            Go to <a href="https://app.lemonsqueezy.com/register" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-[var(--color-primary)]">lemonsqueezy.com</a>
            {" "}and sign up with your business email. Verify the email Lemon Squeezy sends you.
          </>
        ),
      },
      {
        title: "Create your store",
        body: (
          <>
            Once you log in, click <strong>Stores</strong> in the left menu, then <strong>Create store</strong>.
            Give it a name (e.g. your business name) and pick the country you operate in. Your payouts
            will go to a bank account in that country.
          </>
        ),
      },
      {
        title: "Add your bank account",
        body: (
          <>
            In your store settings, click <strong>Payouts</strong> and follow the prompts to connect your bank.
            Lemon Squeezy handles the rest — when a customer pays, the money lands in this account.
          </>
        ),
        note: {
          tone: "info",
          text: "You can use Lemon Squeezy in test mode without verifying your bank. Real payouts need full verification (usually 1–2 business days).",
        },
      },
      {
        title: "Create a 'Pay-what-you-want' product",
        body: (
          <>
            In your store, click <strong>Products → New product</strong>. Name it something generic like
            "Invoice payment" — your clients won't see this name. Click <strong>Pricing</strong> and choose
            "Pay what you want". Set a minimum amount (e.g. $1). Save and <strong>Publish</strong>.
            <br /><br />
            Once published, open the product and click its <strong>variant</strong>. The URL in your
            browser ends with <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">/variants/12345</code> —
            that number is your variant ID. Save it somewhere.
          </>
        ),
      },
      {
        title: "Generate your API key",
        body: (
          <>
            Click your profile (bottom left) → <strong>Settings → API</strong>. Click <strong>Create API key</strong>,
            name it "Orbit", and create. Lemon Squeezy will show you a long string only once — copy it
            immediately.
          </>
        ),
        note: {
          tone: "warning",
          text: "If you close the dialog before copying, you have to delete the key and make a new one. The string can't be revealed again.",
        },
      },
      {
        title: "Connect Orbit",
        body: (
          <>
            Back in Orbit, open <Link href="/payment-settings" className="underline font-semibold text-[var(--color-primary)]">Online Payments</Link>,
            click <strong>Get started</strong> on the Lemon Squeezy card, and follow the wizard.
            It'll ask for the three things you just collected: API key, Store ID, Variant ID.
          </>
        ),
      },
    ],
    cta: { label: "Open my Lemon Squeezy dashboard", href: "https://app.lemonsqueezy.com", external: true },
  },

  // ── Flutterwave ──
  {
    id: "flutterwave",
    icon: CreditCard,
    iconColor: "#F5A623",
    iconBg: "#FFF1DC",
    title: "Set up Flutterwave",
    intro:
      "Best choice if you're based in Nigeria or anywhere across Africa. Accepts cards, mobile money, bank transfers, and USSD. Payouts settle to a local bank.",
    steps: [
      {
        title: "Create your Flutterwave account",
        body: (
          <>
            Sign up at <a href="https://dashboard.flutterwave.com/signup" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-[var(--color-primary)]">flutterwave.com</a>
            {" "}using your business email. Verify the email.
          </>
        ),
      },
      {
        title: "Complete your profile and KYC",
        body: (
          <>
            Once logged in, fill in your business profile (name, type, address) and submit your KYC documents
            (your government ID and a business document if you have one). KYC is required before you can
            receive real payouts. <strong>Test mode works immediately</strong> — you can plug your keys
            into Orbit right away while KYC processes.
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
            Click <strong>Settings → Settlement Account</strong> and add the bank account where you want
            customer payments deposited. Flutterwave will verify it.
          </>
        ),
      },
      {
        title: "Grab your API keys",
        body: (
          <>
            Click <strong>Settings</strong> (bottom left) → <strong>API</strong> tab. You'll see two values:
            <ul className="mt-2 ml-4 space-y-1 list-disc">
              <li><strong>Secret Key</strong> (click the eye to reveal it). Starts with <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">FLWSECK_TEST-</code> in test mode.</li>
              <li><strong>Public Key</strong>. Starts with <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">FLWPUBK_TEST-</code>.</li>
            </ul>
            Copy both. Don't share the secret key.
          </>
        ),
      },
      {
        title: "Connect Orbit",
        body: (
          <>
            Open <Link href="/payment-settings" className="underline font-semibold text-[var(--color-primary)]">Online Payments</Link>{" "}
            in Orbit, click <strong>Get started</strong> on the Flutterwave card, and paste the secret
            and public keys when the wizard asks. Done — Orbit can now create payment links on your
            Flutterwave account.
          </>
        ),
      },
    ],
    cta: { label: "Open my Flutterwave dashboard", href: "https://dashboard.flutterwave.com", external: true },
  },

  // ── Sending payment links ──
  {
    id: "send-link",
    icon: Link2,
    iconColor: "#E8557A",
    iconBg: "#FAEDF1",
    title: "Send your first payment link",
    intro:
      "Once a provider is connected, every invoice you create gets a 'Generate payment link' button. Tap it, share the link with your client, and money lands in your account.",
    steps: [
      {
        title: "Create or open an invoice",
        body: (
          <>
            From <Link href="/payments/new" className="underline font-semibold text-[var(--color-primary)]">Invoice Builder</Link>,
            create an invoice with the amount and client. Or open any existing invoice from{" "}
            <Link href="/payments" className="underline font-semibold text-[var(--color-primary)]">Payments</Link>.
          </>
        ),
      },
      {
        title: "Tap 'Generate payment link'",
        body: (
          <>
            Scroll to the <strong>Get paid online</strong> section on the invoice page. Tap the
            big <strong>Generate payment link</strong> button. Orbit creates a fresh, secure link
            using your connected provider. Takes about 2 seconds.
          </>
        ),
      },
      {
        title: "Share the link with your client",
        body: (
          <>
            You'll see three buttons appear: <strong>Copy link</strong>, <strong>Send via WhatsApp</strong>,
            and <strong>Preview</strong>. WhatsApp opens with a friendly pre-written message
            and the link already inside.
          </>
        ),
      },
      {
        title: "They pay, the invoice updates",
        body: (
          <>
            Your client clicks the link, lands on your provider's hosted checkout (no app install needed),
            and pays with their card. The moment the payment clears, Orbit marks the invoice as{" "}
            <strong>Paid</strong> automatically — no action needed from you.
          </>
        ),
        note: {
          tone: "info",
          text: "Auto-marking-paid works once your provider's webhook is set up. See 'Webhook setup (optional)' below.",
        },
      },
    ],
  },

  // ── Optional webhook section ──
  {
    id: "webhook",
    icon: ShieldCheck,
    iconColor: "#22C55E",
    iconBg: "#DCFCE7",
    title: "Webhook setup (optional, but recommended)",
    intro:
      "Webhooks let your provider tell Orbit when a payment is complete, so invoices flip to 'Paid' instantly without you doing anything. If you skip this, you'll need to manually mark invoices as paid.",
    steps: [
      {
        title: "Pick a long random secret",
        body: (
          <>
            Generate a random string (any password generator works). Save it somewhere — you'll use it twice.
            Example: <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">orbit_wh_38fK20zaPq</code>
          </>
        ),
      },
      {
        title: "Set the webhook URL in your provider dashboard",
        body: (
          <>
            <strong>Lemon Squeezy:</strong> Settings → Webhooks → New webhook. URL is{" "}
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">https://YOUR-DOMAIN/api/lemonsqueezy/webhook</code>.
            Paste your secret as the signing secret. Check the box for <strong>order_created</strong>.
            <br /><br />
            <strong>Flutterwave:</strong> Settings → Webhooks. URL is{" "}
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">https://YOUR-DOMAIN/api/flutterwave/webhook</code>.
            Paste your secret as the "Secret Hash". Save.
          </>
        ),
      },
      {
        title: "Add the secret to your Orbit deployment",
        body: (
          <>
            In your Orbit deployment's environment variables, set:
            <ul className="mt-2 ml-4 space-y-1 list-disc">
              <li><code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">LEMONSQUEEZY_WEBHOOK_SECRET</code> = the same value</li>
              <li><code className="px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-tiny font-mono">FLUTTERWAVE_WEBHOOK_HASH</code> = the same value</li>
            </ul>
            Redeploy. Now when a customer pays, Orbit will hear about it within seconds.
          </>
        ),
      },
    ],
  },
];

// FAQ
const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Does Orbit take a cut of my payments?",
    a: (
      <>
        No. Orbit doesn't touch your money. You connect <strong>your own</strong> Lemon Squeezy or
        Flutterwave account, and customer payments go straight from them to your bank. The only fees
        you pay are your provider's standard transaction fees.
      </>
    ),
  },
  {
    q: "Which provider should I pick?",
    a: (
      <>
        If you're in <strong>Nigeria or across Africa</strong>, pick <strong>Flutterwave</strong> —
        local card support, mobile money, USSD, and faster local settlement.
        If you're elsewhere or want to accept payments from international customers,
        pick <strong>Lemon Squeezy</strong> — better global card coverage and automatic tax handling.
        You can switch between them any time.
      </>
    ),
  },
  {
    q: "What happens to my keys?",
    a: (
      <>
        They live in your browser's localStorage only. We never store them in Orbit's database, and
        they never touch our servers in plaintext — they're sent securely from your device to your
        provider every time you generate a link. If you switch devices, you'll need to enter them
        again.
      </>
    ),
  },
  {
    q: "What if my client emails me asking how to pay?",
    a: (
      <>
        Just send them the link again. Each payment link works until the invoice is marked paid (or
        you regenerate it). Use the <strong>Copy link</strong> button on the invoice page.
      </>
    ),
  },
  {
    q: "I made a mistake. Can I undo a payment?",
    a: (
      <>
        Yes — refund the payment from your Lemon Squeezy or Flutterwave dashboard. Orbit won't
        automatically un-mark the invoice as paid, but you can do that manually by opening the
        invoice and changing the status.
      </>
    ),
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [openSection, setOpenSection] = useState<string | null>("lemonsqueezy");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS;
    const q = search.toLowerCase();
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.intro.toLowerCase().includes(q) ||
        s.steps.some((step) => step.title.toLowerCase().includes(q)),
    );
  }, [search]);

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Hero */}
      <div>
        <div className="inline-flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-[var(--color-primary)]" />
          <span className="text-tiny font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Help & Guides
          </span>
        </div>
        <h1 className="text-page font-bold">How to set up payments</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2 max-w-2xl">
          Plain-English walkthroughs to get you accepting client payments, step by step. No tech experience needed.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the guides..."
          className="w-full h-12 pl-11 pr-4 rounded-full bg-white border border-[var(--color-border)] text-body placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
        />
      </div>

      {/* Quick links */}
      <div id="payments" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickLink
          icon={CreditCard}
          color="#FFC233"
          label="Set up Lemon Squeezy"
          onClick={() => {
            setOpenSection("lemonsqueezy");
            document.getElementById("section-lemonsqueezy")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

      {/* Sections */}
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
                  className={`h-5 w-5 text-[var(--color-muted)] flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
                  <ChevronDown className={`h-4 w-4 text-[var(--color-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
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

// ─── Helpers ───────────────────────────────────────────────────────────────

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
function Step({ index, step, accentColor }: { index: number; step: GuideStep; accentColor: string }) {
  return (
    <div className="flex gap-4">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-small font-bold text-white"
        style={{ backgroundColor: accentColor }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <h3 className="text-body font-semibold text-[var(--color-ink)] mb-2">{step.title}</h3>
        <div className="text-small text-[var(--color-ink-mid)] leading-relaxed">{step.body}</div>
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
