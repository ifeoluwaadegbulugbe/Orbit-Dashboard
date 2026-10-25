"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Receipt, AlertCircle, Clock, CheckCircle2, ShieldCheck, CalendarClock, Sparkles, ArrowRight } from "lucide-react";
import { usePayments } from "@/hooks/usePayments";
import { useClients } from "@/hooks/useClients";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import { SuggestButton } from "@/components/ai/SuggestButton";
import { formatShortDate, relativeDate } from "@/lib/utils";
import { OrbitPayPanel } from "@/components/orbit-pay/OrbitPayPanel";
import { useCurrency } from "@/hooks/useCurrency";
import type { PaymentStatus } from "@/types";

type Tab = "invoices" | "pay";

const STATUS_STYLE: Record<PaymentStatus, { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }> = {
  paid:     { tone: "success", label: "Paid" },
  pending:  { tone: "warning", label: "Pending" },
  overdue:  { tone: "danger",  label: "Overdue" },
  partial:  { tone: "info",    label: "Partial" },
  failed:   { tone: "danger",  label: "Failed" },
  refunded: { tone: "neutral", label: "Refunded" },
};

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>("invoices");
  const { isPro } = useSubscription();
  const { data: payments = [], isLoading } = usePayments();
  const { data: clients = [] } = useClients();
  const { format: formatCurrency, country } = useCurrency();
  // Orbit Pay is Nigeria-only for now (naira, Nigerian bank accounts).
  const orbitPayAvailable = country.code === "NG";
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "pay") setTab("pay");
  }, []);
  const [paywallOpen, setPaywallOpen] = useState(false);
  // "Draft reminder" needs phone/email, which the payment row doesn't carry.
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const outstanding = payments
    .filter((p) => ["pending", "overdue", "partial"].includes(p.status))
    .reduce((sum, p) => sum + (p.remaining_balance ?? p.amount), 0);

  const collected = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.paid_amount ?? p.amount), 0);

  const overdueCount = payments.filter((p) => p.status === "overdue").length;
  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const unpaidCount = overdueCount + pendingCount;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-page font-bold">Money</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">Invoices and payments.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)]">
        {(orbitPayAvailable ? (["invoices", "pay"] as const) : (["invoices"] as const)).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-small font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
            }`}
          >
            {key === "invoices" ? <Receipt className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {key === "invoices" ? "Invoices" : "Orbit Pay"}
          </button>
        ))}
      </div>

      {tab === "invoices" || !orbitPayAvailable ? (
        <div className="space-y-8">
          {/* Headline totals */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
            <SummaryCard
              tone="warning"
              icon={<Clock className="h-5 w-5" />}
              label="Outstanding"
              value={formatCurrency(outstanding)}
              hint={`${unpaidCount} unpaid`}
            />
            <SummaryCard
              tone="danger"
              icon={<AlertCircle className="h-5 w-5" />}
              label="Overdue"
              value={overdueCount}
              hint={overdueCount === 1 ? "1 invoice" : `${overdueCount} invoices`}
            />
            <SummaryCard
              tone="success"
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Collected"
              value={formatCurrency(collected)}
              hint="Lifetime"
            />
          </div>

          {/* Orbit Pay nudge: unpaid invoices are the moment a pay link helps most */}
          {orbitPayAvailable && unpaidCount > 0 && (
            <button
              onClick={() => setTab("pay")}
              className="w-full flex items-center gap-4 px-4 sm:px-6 py-5 bg-[var(--color-primary-subtle)] rounded-[var(--radius-2xl)] border border-[var(--color-primary)]/20 text-left hover:border-[var(--color-primary)]/40 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-white text-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body font-semibold text-[var(--color-ink)]">
                  {unpaidCount} {unpaidCount === 1 ? "invoice is" : "invoices are"} unpaid
                </div>
                <div className="text-small text-[var(--color-ink-light)] mt-0.5">
                  Send an Orbit Pay link so clients can pay by card or bank transfer, straight into your bank.
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--color-primary)] flex-shrink-0" />
            </button>
          )}

          {/* Outstanding cards */}
          <div>
            <h2 className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] mb-4">
              Recent invoices
            </h2>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-[var(--radius-xl)] skeleton" />)}
              </div>
            ) : payments.length === 0 ? (
              <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-6 sm:p-10 text-center">
                <Receipt className="h-8 w-8 text-[var(--color-muted)] mx-auto mb-3" />
                <p className="text-sm text-[var(--color-ink-light)]">No invoices yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.slice(0, 20).map((p) => (
                  <div
                    key={p.id}
                    className="px-4 sm:px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm hover:shadow-soft hover:-translate-y-px transition-all"
                  >
                    <Link href={`/payments/${p.id}`} className="flex items-center gap-3 sm:gap-5">
                      <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                        <Receipt className="h-6 w-6 text-[var(--color-primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-body font-semibold text-[var(--color-ink)] truncate">
                            {p.invoice_number ?? "Invoice"} · {p.client_name}
                          </div>
                          {p.booking_id && (
                            <span title="Created from a booking">
                              <CalendarClock className="h-3.5 w-3.5 text-[var(--color-muted)] flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-small text-[var(--color-muted)] mt-1">
                          {p.status === "overdue" ? "Due " : ""}
                          {formatShortDate(p.date)} · {relativeDate(p.date)}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-body font-bold text-[var(--color-ink)] tabular-nums whitespace-nowrap">{formatCurrency(p.amount)}</div>
                        <Badge tone={STATUS_STYLE[p.status].tone} className="mt-1.5">
                          {STATUS_STYLE[p.status].label}
                        </Badge>
                      </div>
                    </Link>
                    {(p.status === "overdue" || p.status === "pending") && (
                      <SuggestButton
                        label="Draft reminder"
                        kind="invoice_chase"
                        context={{
                          clientName: p.client_name,
                          amount: formatCurrency(p.amount),
                          daysOverdue: p.status === "overdue"
                            ? Math.floor((Date.now() - new Date(p.date).getTime()) / 86_400_000)
                            : 0,
                        }}
                        locked={!isPro}
                        onLocked={() => setPaywallOpen(true)}
                        clientPhone={clientById.get(p.client_id)?.whatsapp_number || clientById.get(p.client_id)?.phone}
                        clientInstagram={clientById.get(p.client_id)?.instagram}
                        clientTiktok={clientById.get(p.client_id)?.tiktok}
                        clientEmail={clientById.get(p.client_id)?.email}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <OrbitPayPanel />
      )}

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}

function SummaryCard({
  tone, icon, label, value, hint,
}: { tone: "warning" | "danger" | "success"; icon: React.ReactNode; label: string; value: string | number; hint: string }) {
  const bg = { warning: "var(--color-warning-light)", danger: "var(--color-danger-light)", success: "var(--color-success-light)" }[tone];
  const fg = { warning: "var(--color-warning-deep)", danger: "var(--color-danger-deep)", success: "var(--color-success-deep)" }[tone];
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
      <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between mb-3 sm:mb-5">
        <span className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)] min-w-0 pt-1">{label}</span>
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg, color: fg }}>
          {icon}
        </div>
      </div>
      <div className="text-[1.375rem] sm:text-stat leading-tight font-bold tabular-nums truncate" title={String(value)}>{value}</div>
      <div className="mt-2 text-small text-[var(--color-muted)]">{hint}</div>
    </div>
  );
}
