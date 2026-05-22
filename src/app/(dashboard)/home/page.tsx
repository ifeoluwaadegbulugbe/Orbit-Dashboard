"use client";

import Link from "next/link";
import {
  Users, UserCheck, Wallet, TrendingUp,
  Plus, Receipt, Briefcase, CalendarPlus,
  ChevronRight, Bell, Cake, Calendar,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickAction } from "@/components/dashboard/QuickAction";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { BookingActions } from "@/components/bookings/BookingActions";
import { useAuthStore } from "@/stores/authStore";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useBookings } from "@/hooks/useBookings";
import { greetingForHour, formatShortDate, relativeDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";

export default function HomePage() {
  const profile = useAuthStore((s) => s.profile);
  const { format: formatCurrency } = useCurrency();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();

  const today = new Date().toISOString().slice(0, 10);
  const todaysBookings = bookings.filter((b) => b.date === today);
  // All pending bookings regardless of date - these are the ones the user
  // needs to confirm or decline as soon as possible.
  const pendingBookings = bookings.filter((b) => b.status === "pending").slice(0, 5);

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";

  const activeClients = clients.filter((c) => c.status === "active").length;
  const outstandingTotal = payments
    .filter((p) => p.status === "pending" || p.status === "overdue" || p.status === "partial")
    .reduce((sum, p) => sum + (p.remaining_balance ?? p.amount), 0);
  const revenue = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.paid_amount ?? p.amount), 0);

  const followUps = clients.filter((c) => c.status === "follow_up").slice(0, 4);
  const overdueInvoices = payments.filter((p) => p.status === "overdue").slice(0, 4);
  const upcomingBirthdays = clients
    .filter((c) => c.birthday)
    .map((c) => ({ ...c, daysAway: daysUntilBirthday(c.birthday!) }))
    .filter((c) => c.daysAway >= 0 && c.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 4);

  return (
    <div className="space-y-10">
      {/* ─── Greeting ─── */}
      <div>
        <h1 className="text-page font-bold text-[var(--color-ink)]">
          {greetingForHour()}, {firstName} 🌸
        </h1>
        <p className="mt-3 text-lead text-[var(--color-ink-light)]">
          Here&apos;s a quick look at your business today.
        </p>
      </div>

      {/* ─── Stat cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Clients" value={clients.length} icon={Users} tone="primary" />
        <StatCard label="Active" value={activeClients} icon={UserCheck} tone="success" />
        <StatCard label="Outstanding" value={formatCurrency(outstandingTotal)} icon={Wallet} tone="warning" />
        <StatCard label="Revenue" value={formatCurrency(revenue)} icon={TrendingUp} tone="info" />
      </div>

      {/* ─── Pending bookings - confirm-or-decline in one tap ─── */}
      {pendingBookings.length > 0 && (
        <div className="bg-white rounded-[var(--radius-2xl)] border-2 border-[var(--color-warning)]/30 shadow-soft-sm overflow-hidden">
          <div className="px-7 py-5 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-warning-light)]/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-light)] flex items-center justify-center">
                <Calendar className="h-5 w-5 text-[var(--color-warning-deep)]" />
              </div>
              <div>
                <h2 className="text-card-title font-semibold text-[var(--color-ink)]">
                  {pendingBookings.length} {pendingBookings.length === 1 ? "booking" : "bookings"} need your confirmation
                </h2>
                <p className="text-small text-[var(--color-ink-light)] mt-0.5">
                  Confirm fast so your client knows you got their request.
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {pendingBookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-7 py-4">
                <Avatar name={b.client_name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold text-[var(--color-ink)] truncate">
                    {b.client_name}
                  </div>
                  <div className="text-small text-[var(--color-muted)] mt-0.5 truncate">
                    {b.title} - {formatShortDate(b.date)} at {b.time}
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
      )}

      {/* ─── Quick actions - vertical list of rows ─── */}
      <div>
        <h2 className="text-card-title font-semibold text-[var(--color-ink)] mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-col gap-3">
          <QuickAction label="Add Client"  href="/clients/new"     icon={Plus} />
          <QuickAction label="New Invoice" href="/payments/new"    icon={Receipt} />
          <QuickAction label="New Project" href="/work?new=1"      icon={Briefcase} />
          <QuickAction label="Schedule"    href="/work?cal=1"      icon={CalendarPlus} />
        </div>
      </div>

      {/* ─── Two-column sections - each renders only if it has content ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Follow up now */}
        {(clientsLoading || followUps.length > 0) && (
          <Section
            title="Follow up now"
            loading={clientsLoading}
            viewAllHref="/clients?filter=follow_up"
          >
            {followUps.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center gap-4 px-5 py-3.5 rounded-[var(--radius-lg)] hover:bg-[var(--color-border-light)] transition-colors"
              >
                <Avatar name={c.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold text-[var(--color-ink)] truncate">{c.name}</div>
                  <div className="text-small text-[var(--color-muted)] mt-0.5">
                    Last contacted {c.last_contacted ? relativeDate(c.last_contacted) : "never"}
                  </div>
                </div>
                <Badge tone="warning">Follow up</Badge>
              </Link>
            ))}
          </Section>
        )}

        {/* Overdue invoices */}
        {(paymentsLoading || overdueInvoices.length > 0) && (
          <Section
            title="Overdue invoices"
            loading={paymentsLoading}
            viewAllHref="/payments?filter=overdue"
          >
            {overdueInvoices.map((p) => (
              <Link
                key={p.id}
                href={`/payments/${p.id}`}
                className="flex items-center gap-4 px-5 py-3.5 rounded-[var(--radius-lg)] hover:bg-[var(--color-border-light)] transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--color-danger-light)] flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-5 w-5 text-[var(--color-danger-deep)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold text-[var(--color-ink)] truncate">{p.client_name}</div>
                  <div className="text-small text-[var(--color-muted)] mt-0.5">Due {relativeDate(p.date)}</div>
                </div>
                <div className="text-body font-bold text-[var(--color-danger-deep)]">{formatCurrency(p.amount)}</div>
              </Link>
            ))}
          </Section>
        )}

        {/* Today's schedule */}
        {(bookingsLoading || todaysBookings.length > 0) && (
          <Section
            title="Today's schedule"
            loading={bookingsLoading}
            viewAllHref="/work?cal=1"
          >
            {todaysBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-4 px-5 py-3.5 rounded-[var(--radius-lg)] hover:bg-[var(--color-border-light)] transition-colors"
              >
                <Link href={`/clients/${b.client_id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-info-light)] flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-[var(--color-info)]">
                      {formatBookingTime(b.time)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-semibold text-[var(--color-ink)] truncate">{b.client_name}</div>
                    <div className="text-small text-[var(--color-muted)] mt-0.5">{b.title}</div>
                  </div>
                </Link>
                <BookingActions
                  bookingId={b.id}
                  status={b.status}
                  clientName={b.client_name}
                  compact
                />
              </div>
            ))}
          </Section>
        )}

        {/* Upcoming birthdays */}
        {upcomingBirthdays.length > 0 && (
          <Section title="Upcoming birthdays">
            {upcomingBirthdays.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                  <Cake className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold text-[var(--color-ink)] truncate">{c.name}</div>
                  <div className="text-small text-[var(--color-muted)] mt-0.5">
                    {c.daysAway === 0 ? "Today 🎂" : c.daysAway === 1 ? "Tomorrow" : `In ${c.daysAway} days`}
                  </div>
                </div>
                <Bell className="h-4 w-4 text-[var(--color-muted)]" />
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  loading,
  viewAllHref,
}: {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  viewAllHref?: string;
}) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm">
      <div className="flex items-center justify-between px-7 py-5 border-b border-[var(--color-border)]">
        <h3 className="text-card-title font-semibold text-[var(--color-ink)]">{title}</h3>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] inline-flex items-center gap-0.5"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="py-3">
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-[var(--radius-md)] skeleton" />)}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** Booking time is a 24h "HH:MM" string in the DB. Format it like "2:30pm". */
function formatBookingTime(time: string): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const hour = parseInt(hStr, 10);
  const minute = mStr ?? "00";
  const period = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute}${period}`;
}

function daysUntilBirthday(birthday: string): number {
  const now = new Date();
  const bd = new Date(birthday);
  const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
  const target = thisYear < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ? new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate())
    : thisYear;
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
