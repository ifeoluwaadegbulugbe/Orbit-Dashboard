"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Briefcase, Receipt, Plus, Bell, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useBookings } from "@/hooks/useBookings";
import { useAuthStore } from "@/stores/authStore";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { cn, formatShortDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "@/types";
import { useProjectStatus, PROJECT_STATUS_LABELS } from "@/hooks/useProjectStatus";
import { NewBookingDialog } from "@/components/bookings/NewBookingDialog";

type Tab = "projects" | "invoices";

const TABS: { key: Tab; label: string; icon: typeof Briefcase }[] = [
  { key: "projects", label: "Projects", icon: Briefcase },
  { key: "invoices", label: "Invoices", icon: Receipt },
];

/**
 * Project-led businesses (fewer, higher-value engagements) land on Projects
 * by default; appointment-led businesses land on Invoices, since their
 * schedule now lives on its own Bookings tab - see orbit-overhaul.md §7/§11.
 */
const PROJECT_LED_TYPES = new Set<BusinessType>(["freelancer", "photographer", "event_planner"]);

function defaultTabFor(businessType: BusinessType | undefined): Tab {
  return businessType && PROJECT_LED_TYPES.has(businessType) ? "projects" : "invoices";
}

export default function WorkPage() {
  return (
    <Suspense fallback={<div className="h-40 rounded-[var(--radius-xl)] skeleton" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const search = useSearchParams();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const presetClientId = search.get("clientId") ?? "";
  const [tab, setTab] = useState<Tab>(() => defaultTabFor(profile?.business_type));
  const [bookingDialogOpen, setBookingDialogOpen] = useState(search.get("new") === "1");

  useEffect(() => {
    if (presetClientId) setBookingDialogOpen(true);
  }, [presetClientId]);

  // Create-button label + behaviour changes depending on which tab is active.
  const createCta = {
    projects: { label: "New project", onClick: () => setBookingDialogOpen(true) },
    invoices: { label: "New invoice", onClick: () => router.push("/payments/new") },
  }[tab];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-page font-bold">Work</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">Projects and invoices.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={createCta.onClick}>
          {createCta.label}
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white p-1 rounded-full border border-[var(--color-border)] w-fit max-w-full overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0",
                active ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-ink-light)] hover:text-[var(--color-ink)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "projects" && <ProjectsTab />}
      {tab === "invoices" && <InvoicesTab />}

      <NewBookingDialog
        open={bookingDialogOpen}
        onClose={() => setBookingDialogOpen(false)}
        presetClientId={presetClientId}
      />
    </div>
  );
}

// ─── Projects tab. Each client with active work is a "project" ──────────────

type PaymentSnapshot = "unpaid" | "partial" | "paid";

interface ProjectCard {
  clientId: string;
  clientName: string;
  title: string;
  serviceType: string | null;
  bookings: import("@/types").Booking[];
  startDate: string;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentSnapshot: PaymentSnapshot;
}

function ProjectsTab() {
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const { data: clients = [] } = useClients();
  const { format: formatCurrency } = useCurrency();

  const isLoading = bookingsLoading || paymentsLoading;

  const projects = useMemo<ProjectCard[]>(() => {
    const map = new Map<string, ProjectCard>();

    // Seed each client that has bookings
    bookings.forEach((b) => {
      const existing = map.get(b.client_id);
      if (existing) {
        existing.bookings.push(b);
        if (b.date < existing.startDate) existing.startDate = b.date;
        if (!existing.dueDate || b.date > existing.dueDate) existing.dueDate = b.date;
      } else {
        map.set(b.client_id, {
          clientId: b.client_id,
          clientName: b.client_name,
          title: b.title,
          serviceType: null,
          bookings: [b],
          startDate: b.date,
          dueDate: b.date,
          totalAmount: 0,
          amountPaid: 0,
          balanceDue: 0,
          paymentSnapshot: "unpaid",
        });
      }
    });

    // Roll up the financials from invoices
    payments.forEach((p) => {
      const project = map.get(p.client_id);
      if (!project) return;
      project.totalAmount += p.amount;
      project.amountPaid += p.paid_amount ?? (p.status === "paid" ? p.amount : 0);
    });

    // Compute balance + payment snapshot (status is user-controlled now)
    map.forEach((project) => {
      project.balanceDue = Math.max(0, project.totalAmount - project.amountPaid);
      project.paymentSnapshot =
        project.totalAmount === 0
          ? "unpaid"
          : project.amountPaid === 0
            ? "unpaid"
            : project.balanceDue === 0
              ? "paid"
              : "partial";

      // Use the first booking's title as the project name; tag with business_type
      const first = project.bookings[0];
      project.title = first.title;
      project.serviceType = BUSINESS_TYPE_LABELS[first.business_type] ?? null;
    });

    return Array.from(map.values()).sort((a, b) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    );
  }, [bookings, payments]);

  if (isLoading) return <div className="h-40 rounded-[var(--radius-xl)] skeleton" />;
  if (projects.length === 0) {
    return (
      <Empty
        icon={<Briefcase className="h-10 w-10 text-[var(--color-muted)]" />}
        title="No projects yet"
        sub="Bookings grouped by client appear here. Add a booking to get started."
      />
    );
  }

  // Suppress unused-vars on `clients` since it's wired in for future per-project actions
  void clients;
  return (
    <div className="space-y-4">
      {projects.map((p) => (
        <ProjectRow key={p.clientId} project={p} format={formatCurrency} />
      ))}
    </div>
  );
}

// ─── A single project card ──────────────────────────────────────────────────

const PAYMENT_META: Record<PaymentSnapshot, { label: string; color: string; bg: string }> = {
  paid:    { label: "Paid",          color: "var(--color-success-deep)", bg: "var(--color-success-light)" },
  partial: { label: "Partially paid", color: "var(--color-warning-deep)", bg: "var(--color-warning-light)" },
  unpaid:  { label: "Unpaid",        color: "var(--color-ink-light)",    bg: "var(--color-border-light)" },
};

// Visual config for the read-only status pill shown on the card.
// Editing the status happens on the project detail page.
const STATUS_PILL: Record<
  import("@/hooks/useProjectStatus").ProjectStatus,
  { dot: string; bg: string; color: string }
> = {
  not_started: { dot: "#9A9893", bg: "var(--color-border-light)",      color: "var(--color-ink-mid)" },
  in_progress: { dot: "#6C63FF", bg: "var(--color-info-light)",        color: "var(--color-info)" },
  delivered:   { dot: "#22C55E", bg: "var(--color-success-light)",     color: "var(--color-success-deep)" },
};

function ProjectRow({
  project, format,
}: {
  project: ProjectCard;
  format: (n: number) => string;
}) {
  const { status } = useProjectStatus(project.clientId);
  const pay = PAYMENT_META[project.paymentSnapshot];
  const statusPill = STATUS_PILL[status];

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
      {/* Header. Avatar + title/client + single status pill */}
      <div className="px-5 sm:px-7 pt-6 pb-5 flex items-start gap-4">
        <Avatar name={project.clientName} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="text-card-title font-semibold text-[var(--color-ink)] truncate">{project.title}</h3>
          <div className="flex items-center gap-2 text-small text-[var(--color-ink-light)] mt-1 flex-wrap">
            <span>{project.clientName}</span>
            {project.serviceType && (
              <>
                <span className="text-[var(--color-muted)]">·</span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-canvas)] text-tiny font-semibold">
                  {project.serviceType}
                </span>
              </>
            )}
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tiny font-bold flex-shrink-0"
          style={{ backgroundColor: statusPill.bg, color: statusPill.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusPill.dot }} />
          {PROJECT_STATUS_LABELS[status]}
        </span>
      </div>

      {/* Dates */}
      <div className="px-5 sm:px-7 pb-4 grid grid-cols-2 gap-4">
        <DatePill label="Started" value={formatShortDate(project.startDate)} />
        <DatePill label="Next due" value={project.dueDate ? formatShortDate(project.dueDate) : "Not set"} />
      </div>

      {/* Financial snapshot */}
      {project.totalAmount > 0 && (
        <div className="mx-5 sm:mx-7 mb-5 p-5 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3">
            <FinancialCell label="Total" value={format(project.totalAmount)} />
            <FinancialCell label="Paid" value={format(project.amountPaid)} tone="success" />
            <FinancialCell label="Balance" value={format(project.balanceDue)} tone={project.balanceDue > 0 ? "danger" : undefined} />
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-tiny font-bold"
            style={{ backgroundColor: pay.bg, color: pay.color }}
          >
            {pay.label}
          </span>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5 sm:px-7 py-4 border-t border-[var(--color-border)] flex items-center gap-2 flex-wrap">
        <Link
          href={`/projects/${project.clientId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <Eye className="h-3.5 w-3.5" /> View project
        </Link>
        <Link
          href={`/payments/new?clientId=${project.clientId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-semibold border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors"
        >
          <Receipt className="h-3.5 w-3.5" /> Send invoice
        </Link>
        <Link
          href={`/reminders?clientId=${project.clientId}&new=1`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-semibold border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors"
        >
          <Bell className="h-3.5 w-3.5" /> Send reminder
        </Link>
      </div>
    </div>
  );
}

function DatePill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div className="text-small sm:text-body font-semibold text-[var(--color-ink)] mt-0.5">{value}</div>
    </div>
  );
}

function FinancialCell({
  label, value, tone,
}: { label: string; value: string; tone?: "success" | "danger" }) {
  const color = tone === "success"
    ? "var(--color-success-deep)"
    : tone === "danger"
      ? "var(--color-danger-deep)"
      : "var(--color-ink)";
  return (
    <div>
      <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div className="text-small sm:text-body font-bold mt-0.5 tabular-nums break-words" style={{ color }}>{value}</div>
    </div>
  );
}

// ─── Invoices tab - same data as /payments but inline ────────────────────────

function InvoicesTab() {
  const { data: payments = [], isLoading } = usePayments();
  const { format: formatCurrency } = useCurrency();

  if (isLoading) return <div className="h-40 rounded-[var(--radius-xl)] skeleton" />;
  if (payments.length === 0) {
    return (
      <Empty
        icon={<Receipt className="h-10 w-10 text-[var(--color-muted)]" />}
        title="No invoices yet"
        sub="Create your first invoice from the Payments tab."
      />
    );
  }

  return (
    <div className="space-y-2">
      {payments.slice(0, 30).map((p) => (
        <Link
          key={p.id}
          href={`/payments/${p.id}`}
          className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-soft-sm hover:shadow-soft transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
            <Receipt className="h-4 w-4 text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{p.client_name}</div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">
              {p.invoice_number ?? "Invoice"} · {formatShortDate(p.date)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="text-sm font-bold tabular-nums whitespace-nowrap">{formatCurrency(p.amount)}</div>
            <Badge tone={p.status === "paid" ? "success" : p.status === "overdue" ? "danger" : "warning"}>
              {p.status}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-6 sm:p-10 text-center">
      <div className="mx-auto mb-3">{icon}</div>
      <h3 className="text-base font-bold mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-ink-light)] max-w-sm mx-auto">{sub}</p>
    </div>
  );
}
