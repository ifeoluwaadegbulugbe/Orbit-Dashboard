import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "info";
  hint?: string;
}

const TONE_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-[var(--color-primary-subtle)]",
  success: "bg-[var(--color-success-light)]",
  warning: "bg-[var(--color-warning-light)]",
  info:    "bg-[var(--color-info-light)]",
};
const TONE_ICON: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "text-[var(--color-primary)]",
  success: "text-[var(--color-success-deep)]",
  warning: "text-[var(--color-warning-deep)]",
  info:    "text-[var(--color-info)]",
};

export function StatCard({ label, value, icon: Icon, tone = "primary", hint }: StatCardProps) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] p-7 shadow-soft-sm">
      <div className="flex items-center justify-between mb-5">
        <span className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", TONE_BG[tone])}>
          <Icon className={cn("h-5 w-5", TONE_ICON[tone])} />
        </div>
      </div>
      <div className="text-stat font-bold text-[var(--color-ink)]">{value}</div>
      {hint && <div className="mt-2 text-small text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}
