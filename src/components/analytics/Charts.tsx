"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Small, dependency-free charts for Insights. Every chart is tappable - on
 * phones there's no hover, so selecting a bar shows its exact values in a
 * readout above the chart instead of a tooltip.
 */

const COLLECTED = "var(--color-primary)";
const INVOICED = "#F5C2D2";

// ─── Collected vs invoiced, per month ───────────────────────────────────────

export function TrendChart({
  data, format, compact,
}: {
  data: { label: string; collected: number; invoiced: number }[];
  format: (n: number) => string;
  compact: (n: number) => string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.collected, d.invoiced)));
  const ticks = [1, 0.5, 0].map((f) => f * max);
  const active = sel ?? data.length - 1;
  const point = data[active];

  return (
    <div>
      {/* Readout for the selected (or latest) month */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mb-4 min-h-[44px]">
        <span className="text-small font-semibold text-[var(--color-ink)] w-full sm:w-auto">{point?.label}</span>
        <Legend color={COLLECTED} label="Collected" value={point ? format(point.collected) : "-"} />
        <Legend color={INVOICED} label="Invoiced" value={point ? format(point.invoiced) : "-"} />
      </div>

      <div className="flex gap-2">
        {/* Y axis */}
        <div className="flex flex-col justify-between h-48 sm:h-56 text-[10px] text-[var(--color-muted)] tabular-nums text-right pb-0.5 flex-shrink-0">
          {ticks.map((t, i) => <span key={i}>{compact(t)}</span>)}
        </div>
        {/* Bars */}
        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" aria-hidden>
            {ticks.map((_, i) => <div key={i} className="border-t border-dashed border-[var(--color-border)]" />)}
          </div>
          <div className="relative h-48 sm:h-56 flex items-end gap-1 sm:gap-2">
            {data.map((d, i) => (
              <button
                key={d.label + i}
                type="button"
                onClick={() => setSel(i)}
                onMouseEnter={() => setSel(i)}
                aria-label={`${d.label}: collected ${format(d.collected)}, invoiced ${format(d.invoiced)}`}
                className={cn(
                  "flex-1 h-full flex items-end justify-center gap-[2px] rounded-md transition-colors",
                  i === active ? "bg-[var(--color-primary-subtle)]/60" : "hover:bg-[var(--color-canvas)]",
                )}
              >
                <span className="w-[38%] max-w-4 rounded-t-[3px]" style={{ height: `${(d.invoiced / max) * 100}%`, background: INVOICED }} />
                <span className="w-[38%] max-w-4 rounded-t-[3px]" style={{ height: `${(d.collected / max) * 100}%`, background: COLLECTED }} />
              </button>
            ))}
          </div>
          <div className="flex gap-1 sm:gap-2 mt-2">
            {data.map((d, i) => (
              <span
                key={d.label + i}
                className={cn(
                  "flex-1 min-w-0 text-center text-[10px] whitespace-nowrap overflow-visible",
                  i === active ? "text-[var(--color-ink)] font-semibold" : "text-[var(--color-muted)]",
                  // Phones: with 12 months there's only room to label every 3rd one
                  // (plus the selected month); never cut a label to "D...".
                  data.length > 6 && i % 3 !== (data.length - 1) % 3 && i !== active && "invisible sm:visible",
                )}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-small">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-bold text-[var(--color-ink)] tabular-nums">{value}</span>
    </span>
  );
}

// ─── Simple column chart (weekdays, hours) ──────────────────────────────────

export function ColumnChart({
  data, highlightMax = true, unit = "booking",
}: {
  data: { label: string; value: number; short?: string }[];
  highlightMax?: boolean;
  unit?: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.findIndex((d) => d.value === max && d.value > 0);
  const shown = sel ?? peak;

  return (
    <div>
      <div className="text-small text-[var(--color-ink-light)] mb-3 min-h-[20px]">
        {shown >= 0 && data[shown] ? (
          <>
            <span className="font-semibold text-[var(--color-ink)]">{data[shown].label}</span>
            {" · "}
            <span className="tabular-nums">{data[shown].value}</span> {unit}{data[shown].value === 1 ? "" : "s"}
          </>
        ) : (
          "No bookings in this period"
        )}
      </div>
      <div className="h-32 flex items-end gap-1">
        {data.map((d, i) => (
          <button
            key={d.label}
            type="button"
            onClick={() => setSel(i)}
            onMouseEnter={() => setSel(i)}
            aria-label={`${d.label}: ${d.value}`}
            className="flex-1 h-full flex items-end"
          >
            <span
              className="w-full rounded-t-[4px] transition-colors min-h-[3px]"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: highlightMax && i === peak
                  ? "var(--color-primary)"
                  : i === sel ? "var(--color-primary-light)" : "var(--color-border)",
              }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-1 mt-1.5">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-[var(--color-muted)] truncate">
            {d.short ?? d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal share bar row ───────────────────────────────────────────────

export function ShareRow({
  label, value, pct, sub, color = "var(--color-primary)", href,
}: {
  label: string;
  value: string;
  pct: number;
  sub?: string;
  color?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-small font-semibold text-[var(--color-ink)] truncate min-w-0">{label}</span>
        <span className="text-small font-bold tabular-nums whitespace-nowrap">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-[var(--color-border-light)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
      </div>
      {sub && <div className="mt-1 text-tiny text-[var(--color-muted)]">{sub}</div>}
    </>
  );
  return href ? (
    <a href={href} className="block py-2.5 hover:opacity-80 transition-opacity">{body}</a>
  ) : (
    <div className="py-2.5">{body}</div>
  );
}

// ─── Stacked aging bar ──────────────────────────────────────────────────────

export const AGING_COLORS = {
  ok: "#22C55E",
  warn: "#F59E0B",
  bad: "#F97316",
  worst: "#EF4444",
} as const;

export function StackedBar({ parts }: { parts: { amount: number; color: string; label: string }[] }) {
  const total = parts.reduce((a, p) => a + p.amount, 0);
  if (total <= 0) return <div className="h-3 rounded-full bg-[var(--color-border-light)]" />;
  return (
    <div className="h-3 rounded-full overflow-hidden flex bg-[var(--color-border-light)]" role="img"
      aria-label={parts.filter((p) => p.amount > 0).map((p) => `${p.label} ${Math.round((p.amount / total) * 100)}%`).join(", ")}>
      {parts.map((p) => p.amount > 0 && (
        <div key={p.label} style={{ width: `${(p.amount / total) * 100}%`, background: p.color }} />
      ))}
    </div>
  );
}
