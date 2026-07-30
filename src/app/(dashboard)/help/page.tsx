// app/(dashboard)/help/page.tsx
//
// The help / guides page. Contains accordion sections covering Orbit Wallet
// and invoice management.

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen, CreditCard, Receipt, MessageCircle, Search,
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

  // ── Orbit Wallet (replaces the old Stripe/Flutterwave connect flow) ──────
  {
    id: "wallet",
    icon: CreditCard,
    iconColor: "#4F46E5",
    iconBg: "#EEF2FF",
    title: "Getting paid with Orbit Wallet",
    intro:
      "Orbit no longer requires you to connect your own Stripe or Flutterwave account. " +
      "It's moving to a built-in wallet instead — here's where that stands.",
    steps: [
      {
        title: "What changed",
        body: (
          <>
            Connecting your own payment provider is gone. Every Orbit account now gets a
            built-in{" "}
            <Link href="/wallet" className="underline font-semibold text-[var(--color-primary)]">
              Wallet
            </Link>{" "}
            — no API keys, no separate merchant account to set up.
          </>
        ),
      },
      {
        title: "How it will work once live",
        body: (
          <>
            Create an invoice, generate a payment link, your client pays it, and the money
            lands directly in your Orbit Wallet. Withdraw to your bank whenever you want —
            no gateway to configure in between.
          </>
        ),
      },
      {
        title: "Right now",
        body: (
          <>
            Online payment collection is temporarily unavailable while the wallet is being
            built out. Mark invoices as{" "}
            <strong>Paid</strong> manually when a client pays you by cash or bank transfer,
            and check back here for updates.
          </>
        ),
        note: {
          tone: "warning",
          text: "This is a known, temporary gap while Orbit Wallet is being built — not a bug.",
        },
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
    q: "Where did Online Payments (Stripe/Flutterwave) go?",
    a: "It's been replaced by Orbit Wallet, a built-in payment system with no separate provider account to connect. Wallet is being built out now - online payment collection is temporarily unavailable in the meantime.",
  },
  {
    q: "Will Orbit take a cut of my payments?",
    a: "Not decided yet. Orbit Wallet is still being built - if a fee is introduced, it'll be shown clearly before it ever applies to a payment.",
  },
  {
    q: "How do I get paid right now?",
    a: "Mark invoices as paid manually when your client pays you directly (cash, bank transfer, etc.) - open the invoice and click Mark as paid.",
  },
  {
    q: "Can I invoice in my local currency?",
    a: "Yes. Orbit uses your account's currency setting for all invoice amounts.",
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
      <div id="payments" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <QuickLink
          icon={CreditCard}
          color="#4F46E5"
          label="About Orbit Wallet"
          onClick={() => {
            setOpenSection("wallet");
            document.getElementById("section-wallet")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <QuickLink
          icon={Receipt}
          color="#0EA5E9"
          label="Managing invoices"
          onClick={() => {
            setOpenSection("invoices");
            document.getElementById("section-invoices")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <div className="text-body font-bold text-[var(--color-ink)]">Want to see the wallet?</div>
          <div className="text-small text-[var(--color-ink-mid)] mt-0.5">
            Check your balance and activity in the meantime.
          </div>
        </div>
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Go to Wallet
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
