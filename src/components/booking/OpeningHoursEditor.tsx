"use client";

import { Clock } from "lucide-react";
import { hoursLabel, toMinutes, type OpeningHours } from "@/lib/booking-hours";

const DAYS = [
  { d: 1, label: "Mon" }, { d: 2, label: "Tue" }, { d: 3, label: "Wed" }, { d: 4, label: "Thu" },
  { d: 5, label: "Fri" }, { d: 6, label: "Sat" }, { d: 0, label: "Sun" },
];

export const DEFAULT_HOURS: OpeningHours = { days: [1, 2, 3, 4, 5, 6], open: "09:00", close: "18:00" };

/**
 * Opening hours for the booking page. Clients then pick from real free
 * times inside these hours instead of typing any time.
 */
export function OpeningHoursEditor({ value, onChange }: { value: OpeningHours | undefined; onChange: (h: OpeningHours) => void }) {
  const h = value ?? DEFAULT_HOURS;
  const toggle = (d: number) => {
    const days = h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d];
    if (days.length) onChange({ ...h, days });
  };
  const badRange = toMinutes(h.close) <= toMinutes(h.open);

  return (
    <div>
      <span className="flex items-center gap-2 text-small font-semibold text-[var(--color-ink)] mb-2">
        <Clock className="h-4 w-4 text-[var(--color-muted)]" /> Opening hours
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Open days">
        {DAYS.map(({ d, label }) => {
          const on = h.days.includes(d);
          return (
            <button key={d} type="button" onClick={() => toggle(d)} aria-pressed={on}
              className={`min-w-[52px] px-3 py-2 rounded-full text-small font-semibold border transition-colors ${on
                ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary)]"
                : "bg-white border-[var(--color-border)] text-[var(--color-muted)]"}`}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 max-w-sm">
        <label className="text-tiny font-semibold text-[var(--color-muted)]">
          Opens
          <input type="time" value={h.open} onChange={(e) => onChange({ ...h, open: e.target.value })}
            className="mt-1 w-full h-11 px-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] text-body text-[var(--color-ink)]" />
        </label>
        <label className="text-tiny font-semibold text-[var(--color-muted)]">
          Closes
          <input type="time" value={h.close} onChange={(e) => onChange({ ...h, close: e.target.value })}
            className="mt-1 w-full h-11 px-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] text-body text-[var(--color-ink)]" />
        </label>
      </div>
      <p className={`mt-2 text-tiny ${badRange ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
        {badRange ? "Closing time must be after opening time." : `Clients see: ${hoursLabel(h)}. They can only pick free times inside these hours.`}
      </p>
    </div>
  );
}
