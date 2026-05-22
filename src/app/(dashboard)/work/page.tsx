"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Briefcase, Receipt, Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Bell, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useBookings, useCreateBooking } from "@/hooks/useBookings";
import { useAuthStore } from "@/stores/authStore";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { cn, formatShortDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import { BUSINESS_TYPE_LABELS } from "@/types";
import { useProjectStatus, PROJECT_STATUS_LABELS } from "@/hooks/useProjectStatus";
import { BookingActions } from "@/components/bookings/BookingActions";
import { useServices } from "@/hooks/useServices";

type Tab = "projects" | "invoices" | "calendar";

const TABS: { key: Tab; label: string; icon: typeof Briefcase }[] = [
  { key: "projects", label: "Projects", icon: Briefcase },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "calendar", label: "Calendar", icon: CalendarIcon },
];

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
  const presetClientId = search.get("clientId") ?? "";
  const [tab, setTab] = useState<Tab>("calendar");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(search.get("new") === "1");
  const { data: allBookings = [] } = useBookings();
  const pendingBookings = allBookings.filter((b) => b.status === "pending");

  useEffect(() => {
    if (presetClientId) setBookingDialogOpen(true);
  }, [presetClientId]);

  // Create-button label + behaviour changes depending on which tab is active.
  const createCta = {
    projects: { label: "New project", onClick: () => setBookingDialogOpen(true) },
    invoices: { label: "New invoice", onClick: () => router.push("/payments/new") },
    calendar: { label: "New booking", onClick: () => setBookingDialogOpen(true) },
  }[tab];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page font-bold">Work</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">Projects, invoices and your schedule.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={createCta.onClick}>
          {createCta.label}
        </Button>
      </div>

      {/* Pending bookings rail - top of the page when there's anything to confirm */}
      {pendingBookings.length > 0 && (
        <div className="bg-white rounded-[var(--radius-2xl)] border-2 border-[var(--color-warning)]/30 shadow-soft-sm overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-warning-light)]/30">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-warning-light)] flex items-center justify-center">
              <CalendarIcon className="h-4 w-4 text-[var(--color-warning-deep)]" />
            </div>
            <div className="flex-1">
              <h2 className="text-card-title font-semibold text-[var(--color-ink)]">
                {pendingBookings.length} pending {pendingBookings.length === 1 ? "booking" : "bookings"}
              </h2>
              <p className="text-small text-[var(--color-ink-light)] mt-0.5">
                Tap confirm or decline. Your client gets faster clarity.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-3 px-6 py-5 min-w-min">
              {pendingBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex-shrink-0 w-[300px] flex flex-col gap-3 p-5 rounded-[var(--radius-xl)] bg-[var(--color-canvas)] border border-[var(--color-border)]"
                >
                  <div>
                    <div className="text-body font-semibold text-[var(--color-ink)] truncate">
                      {b.client_name}
                    </div>
                    <div className="text-small text-[var(--color-muted)] mt-1 truncate">
                      {b.title}
                    </div>
                    <div className="text-small text-[var(--color-ink-light)] mt-2">
                      {formatShortDate(b.date)} at {b.time}
                    </div>
                  </div>
                  <BookingActions
                    bookingId={b.id}
                    status={b.status}
                    clientName={b.client_name}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white p-1 rounded-full border border-[var(--color-border)] w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
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
      {tab === "calendar" && <CalendarTab />}

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
      <div className="px-7 pt-6 pb-5 flex items-start gap-4">
        <Avatar name={project.clientName} size={48} />
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
      <div className="px-7 pb-4 grid grid-cols-2 gap-4">
        <DatePill label="Started" value={formatShortDate(project.startDate)} />
        <DatePill label="Next due" value={project.dueDate ? formatShortDate(project.dueDate) : "Not set"} />
      </div>

      {/* Financial snapshot */}
      {project.totalAmount > 0 && (
        <div className="mx-7 mb-5 p-5 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]">
          <div className="grid grid-cols-3 gap-4 mb-3">
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
      <div className="px-7 py-4 border-t border-[var(--color-border)] flex items-center gap-2 flex-wrap">
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
      <div className="text-body font-semibold text-[var(--color-ink)] mt-0.5">{value}</div>
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
      <div className="text-body font-bold mt-0.5" style={{ color }}>{value}</div>
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
          className="flex items-center gap-4 px-5 py-3.5 bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-soft-sm hover:shadow-soft transition-all"
        >
          <Receipt className="h-4 w-4 text-[var(--color-primary)]" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {p.invoice_number ?? "Invoice"} · {p.client_name}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">{formatShortDate(p.date)}</div>
          </div>
          <div className="text-sm font-bold">{formatCurrency(p.amount)}</div>
          <Badge tone={p.status === "paid" ? "success" : p.status === "overdue" ? "danger" : "warning"}>
            {p.status}
          </Badge>
        </Link>
      ))}
    </div>
  );
}

// ─── Calendar tab - month view ───────────────────────────────────────────────

function CalendarTab() {
  const { data: bookings = [] } = useBookings();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  // Bookings indexed by `YYYY-MM-DD`
  const byDay = useMemo(() => {
    const map = new Map<string, typeof bookings>();
    bookings.forEach((b) => {
      map.set(b.date, [...(map.get(b.date) ?? []), b]);
    });
    return map;
  }, [bookings]);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-soft-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h3 className="text-[15px] font-bold">{monthLabel}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)]"
          >
            <ChevronLeft className="h-4 w-4 text-[var(--color-ink-mid)]" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="px-3 py-1.5 rounded-lg hover:bg-[var(--color-border-light)] text-xs font-semibold text-[var(--color-ink-mid)]"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)]"
          >
            <ChevronRight className="h-4 w-4 text-[var(--color-ink-mid)]" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)] text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`pad-${i}`} className="h-24 border-r border-b border-[var(--color-border)] last:border-r-0 bg-[var(--color-canvas)]/30" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayBookings = byDay.get(key) ?? [];
          return (
            <div
              key={day}
              className={cn(
                "h-24 px-2 py-1.5 border-r border-b border-[var(--color-border)] last:border-r-0",
                isToday(day) && "bg-[var(--color-primary-subtle)]/40",
              )}
            >
              <div className={cn(
                "text-xs font-semibold",
                isToday(day) ? "text-[var(--color-primary)]" : "text-[var(--color-ink-light)]",
              )}>
                {day}
              </div>
              <div className="mt-1 space-y-0.5 overflow-hidden">
                {dayBookings.slice(0, 2).map((b) => (
                  <div
                    key={b.id}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)] truncate"
                    title={`${b.title} - ${b.client_name}`}
                  >
                    {b.client_name.split(" ")[0]}
                  </div>
                ))}
                {dayBookings.length > 2 && (
                  <div className="text-[10px] text-[var(--color-muted)]">+{dayBookings.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── New booking dialog ──────────────────────────────────────────────────────

interface BookingFormValues {
  clientId: string;
  title: string;
  date: string;
  time: string;
  notes: string;
}

function NewBookingDialog({
  open, onClose, presetClientId,
}: { open: boolean; onClose: () => void; presetClientId: string }) {
  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();
  const profile = useAuthStore((s) => s.profile);
  const create = useCreateBooking();
  const [error, setError] = useState<string | null>(null);

  const tomorrow = new Date(Date.now() + 86400000);
  const { register, handleSubmit, reset, formState, setValue, watch } = useForm<BookingFormValues>({
    defaultValues: {
      clientId: presetClientId,
      date: tomorrow.toISOString().slice(0, 10),
      time: "10:00",
    },
  });
  const watchedTitle = watch("title");

  useEffect(() => {
    if (presetClientId) reset((prev) => ({ ...prev, clientId: presetClientId }));
  }, [presetClientId, reset]);

  async function onSubmit(values: BookingFormValues) {
    setError(null);
    const client = clients.find((c) => c.id === values.clientId);
    if (!client) {
      setError("Pick a client first.");
      return;
    }
    if (!profile) {
      setError("Your profile isn't loaded yet. Try again in a moment.");
      return;
    }
    try {
      await create.mutateAsync({
        client_id: client.id,
        client_name: client.name,
        title: values.title.trim(),
        date: values.date,
        time: values.time,
        status: "confirmed",
        notes: values.notes.trim() || null,
        business_type: profile.business_type,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save booking.");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New booking">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-md bg-[var(--color-danger-light)] text-xs text-[var(--color-danger-deep)]">
            {error}
          </div>
        )}

        <Select label="Client" {...register("clientId", { required: true })}>
          <option value="">- Pick a client -</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        {/* Service quick-pick. When the owner has services configured, show
            them as chips above the Title field - tapping fills the title
            instead of typing it manually. */}
        {services.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-small font-semibold text-[var(--color-ink)]">
                Service
              </label>
              <Link
                href="/services"
                className="text-tiny font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-primary)]"
              >
                Edit list
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {services.map((s, i) => {
                const isSelected = watchedTitle === s.name;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setValue("title", s.name, { shouldValidate: true })}
                    className={`px-3.5 py-2 rounded-full border text-small font-semibold transition-colors ${
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]"
                        : "border-[var(--color-border)] bg-white text-[var(--color-ink-light)] hover:border-[var(--color-primary)]/40"
                    }`}
                  >
                    {s.name || "Untitled"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Link
            href="/services"
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-primary-subtle)]/60 hover:bg-[var(--color-primary-subtle)] transition-colors"
          >
            <div className="text-small">
              <div className="font-semibold text-[var(--color-ink)]">Add services to pick from</div>
              <div className="text-tiny text-[var(--color-ink-light)] mt-0.5">
                Build your menu once, use it everywhere.
              </div>
            </div>
          </Link>
        )}

        <Input
          label={services.length > 0 ? "Or type a custom title" : "Title"}
          placeholder="e.g. Hair appointment, Tutoring session"
          {...register("title", { required: true })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date"
            type="date"
            {...register("date", { required: true })}
          />
          <Input
            label="Time"
            type="time"
            {...register("time", { required: true })}
          />
        </div>

        <Textarea label="Notes (optional)" {...register("notes")} />

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting}>Add booking</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
      <div className="mx-auto mb-3">{icon}</div>
      <h3 className="text-base font-bold mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-ink-light)] max-w-sm mx-auto">{sub}</p>
    </div>
  );
}
