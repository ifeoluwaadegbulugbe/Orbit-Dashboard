"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Phone, Mail, Cake, MessageCircle, Receipt, BellPlus,
  Calendar, Edit2, Trash2, Plus,
} from "lucide-react";
import { useClient, useDeleteClient } from "@/hooks/useClients";
import { usePaymentsForClient } from "@/hooks/usePayments";
import { useRemindersForClient } from "@/hooks/useReminders";
import { useBookingsForClient } from "@/hooks/useBookings";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BookingActions } from "@/components/bookings/BookingActions";
import { formatShortDate, relativeDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import type { ClientStatus, PaymentStatus } from "@/types";

const STATUS_TONE: Record<ClientStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  follow_up: "warning",
  overdue: "danger",
  inactive: "neutral",
};

const PAY_TONE: Record<PaymentStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  paid: "success", pending: "warning", overdue: "danger",
  partial: "info", failed: "danger", refunded: "neutral",
};

type Tab = "overview" | "payments" | "reminders" | "bookings" | "notes";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: client, isLoading } = useClient(id);
  const { data: payments = [] } = usePaymentsForClient(id);
  const { data: reminders = [] } = useRemindersForClient(id);
  const { data: bookings = [] } = useBookingsForClient(id);
  const deleteClient = useDeleteClient();
  const { format: formatCurrency } = useCurrency();
  const [tab, setTab] = useState<Tab>("overview");

  async function handleDelete() {
    if (!confirm("Delete this client? Their payments and bookings will also be removed.")) return;
    await deleteClient.mutateAsync(id);
    router.replace("/clients");
  }

  if (isLoading) {
    return <div className="h-40 rounded-[var(--radius-xl)] skeleton" />;
  }
  if (!client) {
    return (
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
        <p className="text-sm text-[var(--color-ink-light)]">Client not found.</p>
        <Link href="/clients" className="inline-block mt-3 text-sm font-semibold text-[var(--color-primary)]">
          Back to clients
        </Link>
      </div>
    );
  }

  const whatsappUrl = `https://wa.me/${client.phone.replace(/\D/g, "")}`;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "payments", label: "Payments", count: payments.length },
    { key: "reminders", label: "Reminders", count: reminders.filter((r) => !r.is_done).length },
    { key: "bookings", label: "Bookings", count: bookings.length },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
      >
        <ChevronLeft className="h-4 w-4" /> All clients
      </Link>

      {/* Hero */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6 lg:p-7">
        <div className="flex items-start gap-5">
          <Avatar name={client.name} size={72} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight truncate">{client.name}</h1>
            <div className="mt-1.5 flex items-center gap-3 flex-wrap">
              <Badge tone={STATUS_TONE[client.status]}>
                {client.status.replace("_", " ")}
              </Badge>
              {client.outstanding_balance > 0 && (
                <span className="text-sm font-bold text-[var(--color-danger-deep)]">
                  {formatCurrency(client.outstanding_balance)} owed
                </span>
              )}
              <span className="text-xs text-[var(--color-muted)]">
                Client since {formatShortDate(client.created_at)}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4 flex-wrap text-sm text-[var(--color-ink-mid)]">
              <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {client.phone}</span>
              {client.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {client.email}</span>}
              {client.birthday && <span className="inline-flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> {formatShortDate(client.birthday)}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/clients/${id}/edit`}>
              <Button variant="secondary" size="sm" leftIcon={<Edit2 className="h-3.5 w-3.5" />}>
                Edit
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/40">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 pt-5 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <QuickAction icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" href={whatsappUrl} external />
          <QuickAction icon={<Receipt className="h-4 w-4" />}        label="Add payment" href={`/payments/new?clientId=${id}`} />
          <QuickAction icon={<BellPlus className="h-4 w-4" />}       label="Add reminder" href={`/reminders?clientId=${id}`} />
          <QuickAction icon={<Calendar className="h-4 w-4" />}       label="Book session" href={`/work?clientId=${id}`} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto bg-white rounded-full border border-[var(--color-border)] p-1 w-fit">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? "bg-white/20" : "bg-[var(--color-border-light)]"}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-soft-sm">
        {tab === "overview" && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
            <SummaryStat label="Total paid"     value={formatCurrency(client.total_paid)} tone="success" />
            <SummaryStat label="Outstanding"    value={formatCurrency(client.outstanding_balance)} tone="warning" />
            <SummaryStat label="Last contacted" value={client.last_contacted ? relativeDate(client.last_contacted) : "Never"} tone="neutral" />
          </div>
        )}

        {tab === "payments" && (
          <TabList
            items={payments}
            empty="No payments logged for this client yet."
            addHref={`/payments/new?clientId=${id}`}
            addLabel="Add payment"
            renderItem={(p) => (
              <Link
                key={p.id}
                href={`/payments/${p.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--color-border-light)] transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-subtle)] flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.invoice_number ?? "Invoice"}</div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    {formatShortDate(p.date)} · {relativeDate(p.date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatCurrency(p.amount)}</div>
                  <Badge tone={PAY_TONE[p.status]} className="mt-0.5">{p.status}</Badge>
                </div>
              </Link>
            )}
          />
        )}

        {tab === "reminders" && (
          <TabList
            items={reminders}
            empty="No reminders for this client."
            addHref={`/reminders?clientId=${id}&new=1`}
            addLabel="Add reminder"
            renderItem={(r) => (
              <div key={r.id} className={`flex items-center gap-3 px-5 py-3.5 ${r.is_done ? "opacity-50" : ""}`}>
                <BellPlus className="h-4 w-4 text-[var(--color-primary)]" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${r.is_done ? "line-through" : ""}`}>{r.message}</div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">Due {formatShortDate(r.due_date)}</div>
                </div>
              </div>
            )}
          />
        )}

        {tab === "bookings" && (
          <TabList
            items={bookings}
            empty="No bookings yet."
            addHref={`/work?clientId=${id}&new=1`}
            addLabel="Book session"
            renderItem={(b) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                <Calendar className="h-4 w-4 text-[var(--color-primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{b.title}</div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    {formatShortDate(b.date)}{b.time ? ` at ${b.time}` : ""}
                  </div>
                </div>
                <BookingActions
                  bookingId={b.id}
                  status={b.status}
                  clientName={client.name}
                  compact
                />
              </div>
            )}
          />
        )}

        {tab === "notes" && (
          <div className="p-6">
            {client.notes ? (
              <p className="text-sm text-[var(--color-ink-mid)] whitespace-pre-wrap leading-relaxed">{client.notes}</p>
            ) : (
              <div className="text-center py-6 text-sm text-[var(--color-muted)]">No notes yet. Edit the client to add some.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, href, external }: { icon: React.ReactNode; label: string; href: string; external?: boolean }) {
  const className =
    "flex items-center justify-center gap-2 px-3 py-2.5 rounded-full bg-[var(--color-canvas)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-ink-mid)] hover:bg-white hover:border-[var(--color-primary)]/30 transition-colors";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {icon} {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {icon} {label}
    </Link>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "neutral" }) {
  const ringClass = {
    success: "border-[var(--color-success)]/20 bg-[var(--color-success-light)]/40",
    warning: "border-[var(--color-warning)]/20 bg-[var(--color-warning-light)]/40",
    neutral: "border-[var(--color-border)] bg-[var(--color-border-light)]/40",
  }[tone];
  return (
    <div className={`rounded-[var(--radius-lg)] border p-5 ${ringClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

function TabList<T>({
  items, empty, renderItem, addHref, addLabel,
}: {
  items: T[];
  empty: string;
  renderItem: (item: T) => React.ReactNode;
  addHref: string;
  addLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <Link href={addHref} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-[var(--color-muted)]">{empty}</div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">{items.map(renderItem)}</div>
      )}
    </div>
  );
}
