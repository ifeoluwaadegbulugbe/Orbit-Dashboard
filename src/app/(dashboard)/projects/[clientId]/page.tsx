"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft, Phone, MessageCircle, Receipt, BellPlus, Bell,
  Calendar, FileText, ChevronRight, Sparkles, Mail,
} from "lucide-react";
import { useClient } from "@/hooks/useClients";
import { useBookingsForClient } from "@/hooks/useBookings";
import { usePaymentsForClient } from "@/hooks/usePayments";
import { useRemindersForClient } from "@/hooks/useReminders";
import { useProjectStatus, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/hooks/useProjectStatus";
import { useCurrency } from "@/hooks/useCurrency";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StatusSegmented } from "@/components/ui/StatusSegmented";
import { toast } from "@/stores/toastStore";
import { formatShortDate, relativeDate } from "@/lib/utils";
import { BUSINESS_TYPE_LABELS, type PaymentStatus } from "@/types";

const STATUS_PILL: Record<ProjectStatus, { dot: string; bg: string; color: string }> = {
  not_started: { dot: "#9A9893", bg: "var(--color-border-light)",      color: "var(--color-ink-mid)" },
  in_progress: { dot: "#6C63FF", bg: "var(--color-info-light)",        color: "var(--color-info)" },
  delivered:   { dot: "#22C55E", bg: "var(--color-success-light)",     color: "var(--color-success-deep)" },
};

const PAY_BADGE: Record<PaymentStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  paid: "success", pending: "warning", overdue: "danger",
  partial: "info", failed: "danger", refunded: "neutral",
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);

  const { data: client, isLoading: clientLoading } = useClient(clientId);
  const { data: bookings = [], isLoading: bookingsLoading } = useBookingsForClient(clientId);
  const { data: payments = [] } = usePaymentsForClient(clientId);
  const { data: reminders = [] } = useRemindersForClient(clientId);
  const { status, setStatus } = useProjectStatus(clientId);
  const { format } = useCurrency();

  // Derive project meta from the underlying bookings
  const project = useMemo(() => {
    if (bookings.length === 0) return null;
    const sorted = [...bookings].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return {
      title: first.title,
      serviceType: BUSINESS_TYPE_LABELS[first.business_type] ?? null,
      startDate: first.date,
      dueDate: last.date,
    };
  }, [bookings]);

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
  const amountPaid = payments.reduce(
    (s, p) => s + (p.paid_amount ?? (p.status === "paid" ? p.amount : 0)),
    0,
  );
  const balanceDue = Math.max(0, totalAmount - amountPaid);
  const pendingReminders = reminders.filter((r) => !r.is_done);

  function handleStatusChange(next: ProjectStatus) {
    setStatus(next);
    toast(`Project updated to ${PROJECT_STATUS_LABELS[next]}`, "success");
  }

  if (clientLoading || bookingsLoading) {
    return <div className="h-40 rounded-[var(--radius-xl)] skeleton" />;
  }

  if (!client) {
    return (
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
        <p className="text-body text-[var(--color-ink-light)]">Client not found.</p>
        <Link href="/work" className="inline-block mt-3 text-small font-semibold text-[var(--color-primary)]">
          Back to Work
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <Link
          href="/work"
          className="inline-flex items-center gap-1 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Work
        </Link>
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
          <Sparkles className="h-10 w-10 text-[var(--color-muted)] mx-auto mb-3" />
          <h3 className="text-card-title font-bold mb-1">No project yet</h3>
          <p className="text-small text-[var(--color-ink-light)] max-w-sm mx-auto">
            Add a booking for {client.name} to start a project with them.
          </p>
          <Link
            href={`/work?clientId=${client.id}&new=1`}
            className="inline-flex items-center gap-1.5 px-4 py-2 mt-4 rounded-full text-small font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]"
          >
            Add a booking
          </Link>
        </div>
      </div>
    );
  }

  const pill = STATUS_PILL[status];
  const whatsappUrl = `https://wa.me/${client.phone.replace(/\D/g, "")}`;

  return (
    <div className="space-y-7">
      <Link
        href="/work"
        className="inline-flex items-center gap-1 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Work
      </Link>

      {/* ─── Header ─── */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7 lg:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Project
            </div>
            <h1 className="text-section font-bold tracking-tight text-[var(--color-ink)] mt-1">
              {project.title}
            </h1>
            {/* Clickable client breadcrumb */}
            <Link
              href={`/clients/${client.id}`}
              className="inline-flex items-center gap-2 mt-2 group"
            >
              <Avatar name={client.name} size={24} />
              <span className="text-body text-[var(--color-ink-mid)] group-hover:text-[var(--color-primary)] transition-colors">
                {client.name}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-primary)] transition-colors" />
            </Link>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tiny font-bold"
              style={{ backgroundColor: pill.bg, color: pill.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pill.dot }} />
              {PROJECT_STATUS_LABELS[status]}
            </span>
            {totalAmount > 0 && (
              <div className="text-section font-bold text-[var(--color-ink)] tabular-nums">
                {format(totalAmount)}
              </div>
            )}
          </div>
        </div>

        {/* Editable status */}
        <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
          <div className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] mb-3">
            Update status
          </div>
          <StatusSegmented value={status} onChange={handleStatusChange} />
        </div>
      </div>

      {/* ─── Two-column layout on desktop ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ── Main column ── */}
        <div className="space-y-6 min-w-0">
          {/* Overview */}
          <Section title="Overview" icon={<FileText className="h-4 w-4 text-[var(--color-primary)]" />}>
            <div className="grid grid-cols-2 gap-5 px-6 py-5">
              <DateField label="Started" value={formatShortDate(project.startDate)} sub={relativeDate(project.startDate)} />
              <DateField label="Due" value={formatShortDate(project.dueDate)} sub={relativeDate(project.dueDate)} />
              {project.serviceType && (
                <DateField label="Service" value={project.serviceType} />
              )}
              <DateField label="Sessions" value={`${bookings.length}`} />
            </div>
          </Section>

          {/* Payments */}
          <Section
            title="Payments"
            icon={<Receipt className="h-4 w-4 text-[var(--color-primary)]" />}
            actionLabel="Send invoice"
            actionHref={`/payments/new?clientId=${client.id}`}
          >
            {totalAmount > 0 && (
              <div className="px-6 py-5 grid grid-cols-3 gap-4 border-b border-[var(--color-border)]">
                <Money label="Total" value={format(totalAmount)} />
                <Money label="Paid" value={format(amountPaid)} tone="success" />
                <Money label="Balance" value={format(balanceDue)} tone={balanceDue > 0 ? "danger" : undefined} />
              </div>
            )}

            {payments.length === 0 ? (
              <div className="px-6 py-8 text-center text-small text-[var(--color-muted)]">
                No invoices yet. Send one to start getting paid.
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {payments.map((p) => (
                  <Link
                    key={p.id}
                    href={`/payments/${p.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--color-border-light)] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                      <Receipt className="h-4 w-4 text-[var(--color-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-small font-semibold truncate">{p.invoice_number ?? "Invoice"}</div>
                      <div className="text-tiny text-[var(--color-muted)] mt-0.5">
                        {formatShortDate(p.date)} · {relativeDate(p.date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-small font-bold">{format(p.amount)}</div>
                      <Badge tone={PAY_BADGE[p.status]} className="mt-0.5">{p.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Activity (reminders) */}
          <Section
            title="Activity"
            icon={<Bell className="h-4 w-4 text-[var(--color-primary)]" />}
            actionLabel="Add reminder"
            actionHref={`/reminders?clientId=${client.id}&new=1`}
          >
            {pendingReminders.length === 0 ? (
              <div className="px-6 py-8 text-center text-small text-[var(--color-muted)]">
                No active reminders for this project.
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {pendingReminders.map((r) => (
                  <div key={r.id} className="flex items-start gap-4 px-6 py-4">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                      <BellPlus className="h-4 w-4 text-[var(--color-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-small font-semibold">{r.message}</div>
                      <div className="text-tiny text-[var(--color-muted)] mt-0.5">
                        Due {formatShortDate(r.due_date)} · {relativeDate(r.due_date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Bookings list */}
          <Section
            title="Sessions"
            icon={<Calendar className="h-4 w-4 text-[var(--color-primary)]" />}
            actionLabel="Add session"
            actionHref={`/work?clientId=${client.id}&new=1`}
          >
            <div className="divide-y divide-[var(--color-border)]">
              {bookings.map((b) => (
                <div key={b.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-info-light)] flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-4 w-4 text-[var(--color-info)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-small font-semibold">{b.title}</div>
                    <div className="text-tiny text-[var(--color-muted)] mt-0.5">
                      {formatShortDate(b.date)} at {b.time}
                    </div>
                  </div>
                  <Badge
                    tone={
                      b.status === "completed"
                        ? "success"
                        : b.status === "cancelled"
                          ? "neutral"
                          : "primary"
                    }
                  >
                    {b.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Section>

          {/* Notes */}
          {client.notes && (
            <Section
              title="Notes about the client"
              icon={<FileText className="h-4 w-4 text-[var(--color-primary)]" />}
            >
              <div className="px-6 py-5 text-small text-[var(--color-ink-mid)] leading-relaxed whitespace-pre-wrap">
                {client.notes}
              </div>
            </Section>
          )}
        </div>

        {/* ── Sidebar: Client card ── */}
        <aside className="space-y-5">
          <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6">
            <div className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] mb-4">
              Client
            </div>
            <div className="flex flex-col items-center text-center">
              <Avatar name={client.name} size={72} />
              <h3 className="text-body font-bold text-[var(--color-ink)] mt-3 truncate w-full">
                {client.name}
              </h3>
              <p className="text-tiny text-[var(--color-muted)] mt-0.5">
                {BUSINESS_TYPE_LABELS[client.business_type] ?? "Client"}
              </p>
            </div>

            <div className="mt-5 pt-5 border-t border-[var(--color-border)] space-y-3">
              <ContactRow icon={<Phone className="h-3.5 w-3.5" />} value={client.phone} />
              {client.email && (
                <ContactRow icon={<Mail className="h-3.5 w-3.5" />} value={client.email} />
              )}
            </div>

            <div className="mt-5 space-y-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-small font-semibold hover:opacity-90 transition-opacity"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
              <Link
                href={`/clients/${client.id}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white border border-[var(--color-border)] text-small font-semibold hover:bg-[var(--color-canvas)] transition-colors"
              >
                View client
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6">
            <div className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] mb-4">
              At a glance
            </div>
            <ul className="space-y-3 text-small">
              <li className="flex justify-between gap-3">
                <span className="text-[var(--color-ink-light)]">Sessions</span>
                <span className="font-semibold text-[var(--color-ink)]">{bookings.length}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-[var(--color-ink-light)]">Invoices</span>
                <span className="font-semibold text-[var(--color-ink)]">{payments.length}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-[var(--color-ink-light)]">Reminders</span>
                <span className="font-semibold text-[var(--color-ink)]">{pendingReminders.length}</span>
              </li>
              {totalAmount > 0 && (
                <li className="flex justify-between gap-3 pt-3 border-t border-[var(--color-border)]">
                  <span className="text-[var(--color-ink-light)]">Outstanding</span>
                  <span
                    className="font-bold tabular-nums"
                    style={{
                      color: balanceDue > 0 ? "var(--color-danger-deep)" : "var(--color-success-deep)",
                    }}
                  >
                    {format(balanceDue)}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function Section({
  title, icon, children, actionLabel, actionHref,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-body font-bold text-[var(--color-ink)]">{title}</h3>
        </div>
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="text-tiny font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            {actionLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function DateField({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-body font-semibold text-[var(--color-ink)] mt-0.5">{value}</div>
      {sub && <div className="text-tiny text-[var(--color-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

function Money({
  label, value, tone,
}: { label: string; value: string; tone?: "success" | "danger" }) {
  const color =
    tone === "success" ? "var(--color-success-deep)" :
    tone === "danger"  ? "var(--color-danger-deep)" :
    "var(--color-ink)";
  return (
    <div>
      <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-body font-bold mt-0.5 tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-small text-[var(--color-ink-mid)]">
      <span className="text-[var(--color-muted)]">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}
