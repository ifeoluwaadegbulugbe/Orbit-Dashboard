import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-[var(--color-border-light)] text-[var(--color-ink-mid)]",
  primary: "bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]",
  success: "bg-[var(--color-success-light)] text-[var(--color-success-deep)]",
  warning: "bg-[var(--color-warning-light)] text-[var(--color-warning-deep)]",
  danger:  "bg-[var(--color-danger-light)] text-[var(--color-danger-deep)]",
  info:    "bg-[var(--color-info-light)] text-[var(--color-info)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
}

export function Badge({ tone = "neutral", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
