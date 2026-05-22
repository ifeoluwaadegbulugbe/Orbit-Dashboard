"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  /** Tailwind color class for the bar fill - defaults to brand pink. */
  barClassName?: string;
  /** Format the tooltip / Y-axis values (e.g. currency). */
  format?: (n: number) => string;
  height?: number;
}

/**
 * Minimal SVG bar chart - no chart library, no axis chrome, just clean bars on
 * a soft grid. Designed to match Orbit's calm aesthetic.
 */
export function BarChart({
  data,
  barClassName = "fill-[var(--color-primary)]",
  format = (n) => String(n),
  height = 220,
}: BarChartProps) {
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);
  const barWidth = 100 / data.length;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-[var(--color-muted)]" style={{ height }}>
        Not enough data yet.
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: height + 28 }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {/* Soft horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1="0"
            y1={height * p}
            x2="100"
            y2={height * p}
            stroke="var(--color-border)"
            strokeWidth="0.15"
            strokeDasharray="0.6 0.6"
          />
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 10);
          const x = i * barWidth + barWidth * 0.18;
          const w = barWidth * 0.64;
          return (
            <g key={i}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
              <rect
                x={x}
                y={height - h}
                width={w}
                height={h}
                rx="0.8"
                className={cn("transition-opacity hover:opacity-80", barClassName)}
              />
            </g>
          );
        })}
      </svg>
      {/* X labels */}
      <div className="grid mt-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map((d) => (
          <div key={d.label} className="text-[10px] text-[var(--color-muted)] text-center truncate px-1">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
