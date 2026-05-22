"use client";

import Link from "next/link";
import { Receipt, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { usePayments } from "@/hooks/usePayments";
import { Badge } from "@/components/ui/Badge";
import { formatShortDate, relativeDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import type { PaymentStatus } from "@/types";

const STATUS_STYLE: Record<PaymentStatus, { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }> = {
  paid:     { tone: "success", label: "Paid" },
  pending:  { tone: "warning", label: "Pending" },
  overdue:  { tone: "danger",  label: "Overdue" },
  partial:  { tone: "info",    label: "Partial" },
  failed:   { tone: "danger",  label: "Failed" },
  refunded: { tone: "neutral", label: "Refunded" },
};

export default function PaymentsPage() {
  const { data: payments = [], isLoading } = usePayments();
  const { format: formatCurrency } = useCurrency();

  const outstanding = payments
    .filter((p) => ["pending", "overdue", "partial"].includes(p.status))
    .reduce((sum, p) => sum + (p.remaining_balance ?? p.amount), 0);

  const collected = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.paid_amount ?? p.amount), 0);

  const overdueCount = payments.filter((p) => p.status === "overdue").length;
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page font-bold">Payments</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">Track invoices and money owed.</p>
        </div>
      </div>

      {/* Headline totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SummaryCard
          tone="warning"
          icon={<Clock className="h-5 w-5" />}
          label="Outstanding"
          value={formatCurrency(outstanding)}
          hint={`${pendingCount + overdueCount} unpaid`}
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
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
            <Receipt className="h-8 w-8 text-[var(--color-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-ink-light)]">No invoices yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.slice(0, 20).map((p) => (
              <Link
                key={p.id}
                href={`/payments/${p.id}`}
                className="flex items-center gap-5 px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm hover:shadow-soft hover:-translate-y-px transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-6 w-6 text-[var(--color-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold text-[var(--color-ink)] truncate">
                    {p.invoice_number ?? "Invoice"} · {p.client_name}
                  </div>
                  <div className="text-small text-[var(--color-muted)] mt-1">
                    {p.status === "overdue" ? "Due " : ""}
                    {formatShortDate(p.date)} · {relativeDate(p.date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-body font-bold text-[var(--color-ink)]">{formatCurrency(p.amount)}</div>
                  <Badge tone={STATUS_STYLE[p.status].tone} className="mt-1.5">
                    {STATUS_STYLE[p.status].label}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  tone, icon, label, value, hint,
}: { tone: "warning" | "danger" | "success"; icon: React.ReactNode; label: string; value: string | number; hint: string }) {
  const bg = { warning: "var(--color-warning-light)", danger: "var(--color-danger-light)", success: "var(--color-success-light)" }[tone];
  const fg = { warning: "var(--color-warning-deep)", danger: "var(--color-danger-deep)", success: "var(--color-success-deep)" }[tone];
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7">
      <div className="flex items-center justify-between mb-5">
        <span className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</span>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg, color: fg }}>
          {icon}
        </div>
      </div>
      <div className="text-stat font-bold">{value}</div>
      <div className="mt-2 text-small text-[var(--color-muted)]">{hint}</div>
    </div>
  );
}
