"use client";

import { useState, useEffect } from "react";
import { Zap, MessageCircle, Calendar, Cake, type LucideIcon, Bell, Sparkles, Hourglass } from "lucide-react";
import { ProGate } from "@/components/paywall/ProGate";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";

const AUTOMATION_STORAGE_KEY = "orbit_automations_v1";

interface AutomationRule {
  id: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  detail: string;
  enabled: boolean;
  comingSoon?: boolean;
}

const INITIAL_RULES: AutomationRule[] = [
  {
    id: "payment_reminder",
    icon: Hourglass,
    iconBg: "#DCFCE7",
    iconColor: "#166534",
    title: "Payment reminders",
    description: "Auto-remind clients with unpaid invoices",
    detail: "Sends a WhatsApp message 3 days and 7 days after an invoice is due.",
    enabled: true,
  },
  {
    id: "follow_up",
    icon: MessageCircle,
    iconBg: "#FAEDF1",
    iconColor: "#E8557A",
    title: "Quiet-client follow-ups",
    description: "Re-engage clients you haven't talked to in 30+ days",
    detail: "Adds a follow-up reminder when a client goes 30 days without contact.",
    enabled: false,
  },
  {
    id: "booking_confirmation",
    icon: Calendar,
    iconBg: "#EDE9FF",
    iconColor: "#6366F1",
    title: "Booking confirmations",
    description: "Auto-send a confirmation when a session is booked",
    detail: "Clients receive a WhatsApp message confirming their booking time and service.",
    enabled: true,
  },
  {
    id: "birthday_messages",
    icon: Cake,
    iconBg: "#FEF3C7",
    iconColor: "#92400E",
    title: "Birthday messages",
    description: "Send personalised wishes on client birthdays",
    detail: "A warm message goes out automatically on each client's birthday.",
    enabled: false,
    comingSoon: true,
  },
  {
    id: "weekly_summary",
    icon: Sparkles,
    iconBg: "#DCFCE7",
    iconColor: "#166534",
    title: "Weekly business summary",
    description: "Get a Monday-morning recap by email",
    detail: "Revenue, outstanding invoices, busiest day and top clients - sent every Monday at 8am.",
    enabled: false,
    comingSoon: true,
  },
];

export default function AutomationsPage() {
  return (
    <ProGate
      title="Automations"
      description="Set up rules that work for you. Payment reminders, follow-ups, birthday messages - all on autopilot."
    >
      <AutomationsInner />
    </ProGate>
  );
}

function AutomationsInner() {
  const { data: clients = [] } = useClients();
  const { data: payments = [] } = usePayments();

  const [rules, setRules] = useState<AutomationRule[]>(INITIAL_RULES);

  useEffect(() => {
    const raw = localStorage.getItem(AUTOMATION_STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Record<string, boolean>;
        setRules((rs) => rs.map((r) => ({ ...r, enabled: saved[r.id] ?? r.enabled })));
      } catch {
        // ignore
      }
    }
  }, []);

  function toggle(id: string) {
    setRules((rs) => {
      const next = rs.map((r) => (r.id === id && !r.comingSoon ? { ...r, enabled: !r.enabled } : r));
      const snapshot: Record<string, boolean> = {};
      next.forEach((r) => (snapshot[r.id] = r.enabled));
      localStorage.setItem(AUTOMATION_STORAGE_KEY, JSON.stringify(snapshot));
      return next;
    });
  }

  // Live counts that automations would act on
  const overdueCount = payments.filter((p) => p.status === "overdue").length;
  const quietCount = clients.filter((c) => {
    if (!c.last_contacted) return true;
    return Date.now() - new Date(c.last_contacted).getTime() > 30 * 86400000;
  }).length;
  const activeRules = rules.filter((r) => r.enabled && !r.comingSoon).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page font-bold">Automations</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          Rules that run in the background so you can focus on the work.
        </p>
      </div>

      {/* Live impact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Stat icon={Zap}     label="Active rules"        value={activeRules} tone="primary" />
        <Stat icon={Bell}    label="Overdue invoices"    value={overdueCount} tone="warning" />
        <Stat icon={MessageCircle} label="Quiet clients · 30d+" value={quietCount} tone="info" />
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {rules.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.id}
              className={`flex items-start gap-5 px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm transition-opacity ${
                r.comingSoon ? "opacity-60" : ""
              }`}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: r.iconBg }}
              >
                <Icon className="h-5 w-5" style={{ color: r.iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-body font-semibold">{r.title}</span>
                  {r.comingSoon && (
                    <span className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-border-light)] px-2 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>
                <div className="text-small text-[var(--color-ink-light)] mt-0.5">{r.description}</div>
                <div className="text-tiny text-[var(--color-muted)] mt-2 leading-relaxed">{r.detail}</div>
              </div>
              <Toggle enabled={r.enabled} onChange={() => toggle(r.id)} disabled={!!r.comingSoon} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "primary" | "warning" | "info";
}) {
  const bg = { primary: "var(--color-primary-subtle)", warning: "var(--color-warning-light)", info: "var(--color-info-light)" }[tone];
  const fg = { primary: "var(--color-primary)", warning: "var(--color-warning-deep)", info: "var(--color-info)" }[tone];
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
          <Icon className="h-5 w-5" style={{ color: fg }} />
        </div>
        <div>
          <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
          <div className="text-card-title font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  enabled, onChange, disabled,
}: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={enabled}
      className={`flex-shrink-0 relative w-12 h-7 rounded-full transition-colors duration-200 ${
        enabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
      } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-soft-sm transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
