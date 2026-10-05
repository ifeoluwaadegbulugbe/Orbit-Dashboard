"use client";

import { useState } from "react";
import { Zap, MessageCircle, Calendar, Cake, type LucideIcon, Bell, Sparkles, Hourglass, Save, Loader2, Star } from "lucide-react";
import { ProGate } from "@/components/paywall/ProGate";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useMessageRules, useSetMessageRule } from "@/hooks/useMessageRules";
import { getEffectiveRule, type TriggerType } from "@/lib/automations/rules";
import { toast } from "@/stores/toastStore";

interface RuleMeta {
  id: TriggerType;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  detail: string;
  /** Only payment_reminder/client_followup get an editable template - the
      other two stay branded HTML emails for now, not user-edited text. */
  editableTemplate?: boolean;
  templatePlaceholder?: string;
}

const RULES: RuleMeta[] = [
  {
    id: "payment_reminder",
    icon: Hourglass,
    iconBg: "#DCFCE7",
    iconColor: "#166534",
    title: "Payment reminders",
    description: "Auto-email clients with unpaid invoices",
    detail: "Sends once around 3 days overdue, and again around 7 days, then stops.",
    editableTemplate: true,
    templatePlaceholder: "Hi {{client_name}}, just a friendly reminder that {{amount}} is still outstanding...",
  },
  {
    id: "client_followup",
    icon: MessageCircle,
    iconBg: "#FAEDF1",
    iconColor: "#E8557A",
    title: "Quiet-client follow-ups",
    description: "Re-engage clients you haven't talked to in 30+ days",
    detail: "Sends a check-in email once a client goes quiet, then resets the clock.",
    editableTemplate: true,
    templatePlaceholder: "Hi {{client_name}}, it's been a while! Would love to have you back...",
  },
  {
    id: "booking_confirmation",
    icon: Calendar,
    iconBg: "#EDE9FF",
    iconColor: "#6366F1",
    title: "Booking confirmations",
    description: "Auto-send a confirmation when you confirm a booking",
    detail: "Clients get a branded email confirming their booking time and service.",
  },
  {
    id: "appointment_reminder",
    icon: Bell,
    iconBg: "#E0F2FE",
    iconColor: "#0369A1",
    title: "Appointment reminders",
    description: "Remind clients before their appointment to cut no-shows",
    detail: "Clients get email reminders 60, 30 and 5 minutes before each booking.",
  },
  {
    id: "review_request",
    icon: Star,
    iconBg: "#FEF3C7",
    iconColor: "#B45309",
    title: "Review requests",
    description: "Ask clients for a review after their appointment",
    detail: "About 2 hours after an appointment ends, clients get an email asking them to rate it. Reviews show on your booking page.",
  },
  {
    id: "birthday",
    icon: Cake,
    iconBg: "#FEF3C7",
    iconColor: "#92400E",
    title: "Birthday messages",
    description: "Send personalised wishes on client birthdays",
    detail: "A warm email goes out automatically on each client's birthday.",
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
  const { data: rows = [], isLoading } = useMessageRules();
  const setRule = useSetMessageRule();

  const overdueCount = payments.filter((p) => p.status === "overdue").length;
  const quietCount = clients.filter((c) => {
    if (!c.last_contacted) return true;
    return Date.now() - new Date(c.last_contacted).getTime() > 30 * 86400000;
  }).length;
  const activeRules = RULES.filter((r) => getEffectiveRule(rows, r.id).enabled).length;

  async function toggle(rule: RuleMeta) {
    const current = getEffectiveRule(rows, rule.id);
    try {
      await setRule.mutateAsync({ triggerType: rule.id, enabled: !current.enabled, template: current.template });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update this rule", "danger");
    }
  }

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
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[var(--radius-2xl)] skeleton" />)}
          </div>
        ) : (
          RULES.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              effective={getEffectiveRule(rows, rule.id)}
              onToggle={() => toggle(rule)}
              onSaveTemplate={async (template) => {
                const current = getEffectiveRule(rows, rule.id);
                try {
                  await setRule.mutateAsync({ triggerType: rule.id, enabled: current.enabled, template });
                  toast("Template saved", "success");
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Could not save template", "danger");
                }
              }}
            />
          ))
        )}

        {/* Honestly labeled - not built yet */}
        <div className="flex items-start gap-5 px-4 sm:px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm opacity-60">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#DCFCE7" }}>
            <Sparkles className="h-5 w-5" style={{ color: "#166534" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-body font-semibold">Weekly business summary</span>
              <span className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-border-light)] px-2 py-0.5 rounded-full">
                Coming soon
              </span>
            </div>
            <div className="text-small text-[var(--color-ink-light)] mt-0.5">Get a Monday-morning recap by email</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleCard({
  rule, effective, onToggle, onSaveTemplate,
}: {
  rule: RuleMeta;
  effective: { enabled: boolean; template: string | null };
  onToggle: () => void;
  onSaveTemplate: (template: string | null) => Promise<void>;
}) {
  const Icon = rule.icon;
  const [draft, setDraft] = useState(effective.template ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = draft !== (effective.template ?? "");

  async function save() {
    setSaving(true);
    try {
      await onSaveTemplate(draft.trim() || null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm">
      <div className="flex items-start gap-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: rule.iconBg }}>
          <Icon className="h-5 w-5" style={{ color: rule.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-body font-semibold">{rule.title}</span>
          <div className="text-small text-[var(--color-ink-light)] mt-0.5">{rule.description}</div>
          <div className="text-tiny text-[var(--color-muted)] mt-2 leading-relaxed">{rule.detail}</div>
        </div>
        <Toggle enabled={effective.enabled} onChange={onToggle} />
      </div>

      {rule.editableTemplate && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <Textarea
            label="Message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={rule.templatePlaceholder}
            rows={3}
            hint="Leave blank to use Orbit's default wording. Use {{client_name}}, {{amount}} and {{days_overdue}}."
          />
          {dirty && (
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                onClick={save}
                loading={saving}
                leftIcon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              >
                Save template
              </Button>
            </div>
          )}
        </div>
      )}
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

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={enabled}
      className={`flex-shrink-0 relative w-12 h-7 rounded-full transition-colors duration-200 cursor-pointer ${
        enabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-soft-sm transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
