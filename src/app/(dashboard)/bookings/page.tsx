"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useBookings } from "@/hooks/useBookings";
import { usePayments } from "@/hooks/usePayments";
import { formatShortDate, cn } from "@/lib/utils";
import { BookingActions } from "@/components/bookings/BookingActions";
import { NewBookingDialog } from "@/components/bookings/NewBookingDialog";
import type { Booking } from "@/types";

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="h-40 rounded-[var(--radius-xl)] skeleton" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const search = useSearchParams();
  const presetClientId = search.get("clientId") ?? "";
  const [bookingDialogOpen, setBookingDialogOpen] = useState(search.get("new") === "1");
  const { data: allBookings = [] } = useBookings();
  const pendingBookings = allBookings.filter((b) => b.status === "pending");

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-page font-bold">Bookings</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">Your schedule, at a glance.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setBookingDialogOpen(true)}>
          New booking
        </Button>
      </div>

      {/* Pending bookings rail - top of the page when there's anything to confirm */}
      {pendingBookings.length > 0 && (
        <div className="bg-white rounded-[var(--radius-2xl)] border-2 border-[var(--color-warning)]/30 shadow-soft-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-warning-light)]/30">
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
            <div className="flex gap-3 px-4 sm:px-6 py-5 min-w-min">
              {pendingBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex-shrink-0 w-[260px] sm:w-[300px] flex flex-col gap-3 p-5 rounded-[var(--radius-xl)] bg-[var(--color-canvas)] border border-[var(--color-border)]"
                >
                  <div>
                    <div className="text-body font-semibold text-[var(--color-ink)] truncate">
                      {b.client_name}
                    </div>
                    <div className="text-small text-[var(--color-muted)] mt-1 truncate">
                      {b.title}
                    </div>
                    <div className="text-small text-[var(--color-ink-light)] mt-2">
                      {formatShortDate(b.date)} at {b.time?.slice(0, 5)}
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

      <BookingsCalendar />

      <NewBookingDialog
        open={bookingDialogOpen}
        onClose={() => setBookingDialogOpen(false)}
        presetClientId={presetClientId}
      />
    </div>
  );
}

// ─── Calendar - month view ───────────────────────────────────────────────

function BookingsCalendar() {
  const { data: bookings = [] } = useBookings();
  const { data: payments = [] } = usePayments();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // Tapping a day lists its bookings under the grid - the only way to see
  // details on phones, where cells are too narrow for names.
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));

  // booking_id -> payment status, so the calendar can show a paid/unpaid dot
  // without a separate query (Money already has this data cached).
  const paymentByBookingId = useMemo(() => {
    const map = new Map<string, (typeof payments)[number]>();
    payments.forEach((p) => { if (p.booking_id) map.set(p.booking_id, p); });
    return map;
  }, [payments]);

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
          <div key={d} className="px-1 sm:px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)] text-center">
            <span className="sm:hidden">{d.charAt(0)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`pad-${i}`} className="h-14 sm:h-24 border-r border-b border-[var(--color-border)] last:border-r-0 bg-[var(--color-canvas)]/30" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayBookings = byDay.get(key) ?? [];
          const selected = key === selectedKey;
          return (
            <div
              key={day}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => setSelectedKey(key)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelectedKey(key))}
              className={cn(
                "h-14 sm:h-24 px-1 sm:px-2 py-1 sm:py-1.5 border-r border-b border-[var(--color-border)] last:border-r-0 min-w-0 cursor-pointer transition-colors hover:bg-[var(--color-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]",
                isToday(day) && "bg-[var(--color-primary-subtle)]/40",
                selected && "ring-2 ring-inset ring-[var(--color-primary)]/50",
              )}
            >
              <div className={cn(
                "text-xs font-semibold",
                isToday(day) ? "text-[var(--color-primary)]" : "text-[var(--color-ink-light)]",
              )}>
                {day}
              </div>
              {/* Phones: one dot per booking - names don't fit in a ~50px cell */}
              {dayBookings.length > 0 && (
                <div className="sm:hidden mt-1 flex flex-wrap gap-0.5" aria-label={`${dayBookings.length} booking${dayBookings.length === 1 ? "" : "s"}`}>
                  {dayBookings.slice(0, 4).map((b) => (
                    <span key={b.id} className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                  ))}
                </div>
              )}
              <div className="hidden sm:block mt-1 space-y-0.5 overflow-hidden">
                {dayBookings.slice(0, 2).map((b) => {
                  const invoice = paymentByBookingId.get(b.id);
                  const dotColor = invoice
                    ? invoice.status === "paid" ? "var(--color-success)" : "var(--color-warning)"
                    : null;
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)] truncate"
                      title={`${b.title} - ${b.client_name}${invoice ? ` - invoice ${invoice.status}` : ""}`}
                    >
                      {dotColor && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                      )}
                      <span className="truncate">{b.client_name.split(" ")[0]}</span>
                    </div>
                  );
                })}
                {dayBookings.length > 2 && (
                  <div className="text-[10px] text-[var(--color-muted)]">+{dayBookings.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DayAgenda dateKey={selectedKey} bookings={byDay.get(selectedKey) ?? []} />
    </div>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DayAgenda({ dateKey, bookings }: { dateKey: string; bookings: Booking[] }) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const sorted = [...bookings].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  return (
    <div className="border-t border-[var(--color-border)] px-4 sm:px-5 py-4">
      <h4 className="text-small font-semibold text-[var(--color-ink)] mb-2">{label}</h4>
      {sorted.length === 0 ? (
        <p className="text-small text-[var(--color-muted)]">Nothing booked.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {sorted.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2.5">
              <span className="w-12 flex-shrink-0 text-small font-bold tabular-nums text-[var(--color-info)]">{b.time?.slice(0, 5)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-small font-semibold text-[var(--color-ink)] truncate">{b.client_name}</div>
                <div className="text-tiny text-[var(--color-muted)] truncate">{b.title}</div>
              </div>
              <BookingActions bookingId={b.id} status={b.status} clientName={b.client_name} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
