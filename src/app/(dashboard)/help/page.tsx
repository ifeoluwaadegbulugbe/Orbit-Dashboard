// app/(dashboard)/help/page.tsx
//
// The help / guides page: accordion guides plus common questions.

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { feeText } from "@/components/orbit-pay/OrbitPayPanel";
import {
  CreditCard, Receipt, MessageCircle, Search, Users,
  ChevronDown, ExternalLink, AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { ContactSupport } from "@/components/settings/ContactSupport";

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
  {
    id: "getting-started",
    icon: Users,
    iconColor: "#E8557A",
    iconBg: "#FAEDF1",
    title: "Getting started",
    intro: "Add your clients, take bookings and let people book you themselves.",
    steps: [
      {
        title: "Add your clients",
        body: (
          <>
            Go to{" "}
            <Link href="/clients/new" className="underline font-semibold text-[var(--color-primary)]">
              Clients → Add client
            </Link>{" "}
            and save their name, phone number and email. Bookings, invoices and reminders all
            link back to the client.
          </>
        ),
      },
      {
        title: "Schedule a booking",
        body: (
          <>
            From{" "}
            <Link href="/bookings" className="underline font-semibold text-[var(--color-primary)]">
              Bookings
            </Link>
            , tap <strong>New booking</strong> and pick the client, service, date and time.
            Today&apos;s bookings show at the top of your Home screen.
          </>
        ),
      },
      {
        title: "Share your booking link",
        body: (
          <>
            Your{" "}
            <Link href="/booking-link" className="underline font-semibold text-[var(--color-primary)]">
              booking link
            </Link>{" "}
            lets clients book themselves in. Put it in your Instagram bio, WhatsApp status or
            anywhere clients find you. New requests appear on Home for you to confirm or decline.
          </>
        ),
      },
    ],
  },
  {
    id: "invoices",
    icon: Receipt,
    iconColor: "#0EA5E9",
    iconBg: "#E0F2FE",
    title: "Invoices and getting paid",
    intro: "Create invoices, send a payment link, and keep track of what you're owed.",
    steps: [
      {
        title: "Create an invoice",
        body: (
          <>
            Tap{" "}
            <Link href="/payments/new" className="underline font-semibold text-[var(--color-primary)]">
              New invoice
            </Link>
            , choose the client and enter the amount and due date. The invoice number is filled
            in for you.
          </>
        ),
      },
      {
        title: "Send a payment link",
        body: (
          <>
            Open the invoice and tap <strong>Generate payment link</strong>. Send it to your client
            on WhatsApp or email. They can pay by card, bank transfer or USSD, and the invoice is
            marked paid automatically.
          </>
        ),
      },
      {
        title: "Record a payment you received directly",
        body: (
          <>
            If a client pays you in cash or by direct transfer, open the invoice and tap{" "}
            <strong>Mark paid</strong>.
          </>
        ),
      },
      {
        title: "Invoice statuses",
        body: (
          <ul className="mt-1 ml-4 space-y-1 list-disc">
            <li><strong>Pending</strong> - sent, not yet paid</li>
            <li><strong>Overdue</strong> - past the due date and still unpaid</li>
            <li><strong>Partial</strong> - the client has paid part of the amount</li>
            <li><strong>Paid</strong> - fully settled</li>
          </ul>
        ),
      },
    ],
  },
  {
    id: "orbit-pay",
    icon: CreditCard,
    iconColor: "#4F46E5",
    iconBg: "#EEF2FF",
    title: "Orbit Pay",
    intro: "Let clients pay deposits and invoices by card or bank transfer. Payments are processed by Paystack and go straight into your own bank account. Orbit never holds your money.",
    steps: [
      {
        title: "Connect your bank account",
        body: (
          <>
            Go to{" "}
            <Link href="/payments?tab=pay" className="underline font-semibold text-[var(--color-primary)]">
              Money → Orbit Pay
            </Link>
            , pick your bank and enter your account number. Check the account name the bank shows, then confirm.
          </>
        ),
      },
      {
        title: "Choose who pays the processing fee",
        body: <>Absorb it yourself, or let your client pay it as a separate &quot;Processing fee&quot; line.</>,
      },
      {
        title: "Send a payment link",
        body: <>Open an invoice and tap <strong>Create payment link</strong>. When your client pays, the invoice is marked paid and Paystack pays you on its normal settlement schedule.</>,
      },
    ],
  },
];

// ─── FAQs ─────────────────────────────────────────────────────────────────────

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Can I put Orbit on my phone like an app?",
    a: (
      <>
        Yes. <strong>Android:</strong> open Orbit in Chrome, tap the ⋮ menu, then <strong>Install app</strong> (or
        Add to Home screen). <strong>iPhone:</strong> open Orbit in Safari, tap <strong>Share</strong>, then{" "}
        <strong>Add to Home Screen</strong>. Orbit then opens full screen from its own icon, and recent clients and
        bookings still show with no network.
      </>
    ),
  },
  {
    q: "How can my clients pay me?",
    a: "With Orbit Pay, send a payment link from any invoice and they pay by card or bank transfer. If they pay you by transfer or cash directly, tap Mark paid on the invoice. That's free.",
  },
  {
    q: "Are there any fees?",
    a: `Orbit Pay costs ${feeText("free")} on Free, and ${feeText("pro")} on Pro. You choose whether you or your client pays it. Invoices you mark as paid yourself are free.`,
  },
  {
    q: "Where does my money go?",
    a: "Straight into your own bank account. Payments are processed by Paystack, a licensed payment processor, and settled to the account you connected. Orbit is business software, not a bank, and never holds your money.",
  },
  {
    q: "How do refunds work?",
    a: "Open the paid invoice and tap Refund. Paystack returns the money to your client and takes it from your next settlement.",
  },
  {
    q: "Can I invoice in my local currency?",
    a: "Yes. Orbit uses your account's currency setting for all invoice amounts.",
  },
  {
    q: "Can I get a copy of my data?",
    a: (
      <>
        Yes - go to{" "}
        <Link href="/export" className="underline font-semibold text-[var(--color-primary)]">
          Export Data
        </Link>{" "}
        to download your clients, invoices and bookings.
      </>
    ),
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
          Quick guides to running your business on Orbit.
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
      <div className="hidden sm:grid grid-cols-3 gap-3">
        {SECTIONS.map((section) => (
          <QuickLink
            key={section.id}
            icon={section.icon}
            color={section.iconColor}
            label={section.title}
            onClick={() => {
              setQuery("");
              setOpenSection(section.id);
              document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ))}
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
                  className="w-full px-4 sm:px-6 py-4 flex items-center gap-3 text-left hover:bg-[var(--color-canvas)] transition-colors"
                >
                  <span className="flex-1 text-body font-semibold">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--color-muted)] transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-6 pb-5 text-body text-[var(--color-ink-mid)] leading-relaxed border-t border-[var(--color-border)] pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ContactSupport />
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
