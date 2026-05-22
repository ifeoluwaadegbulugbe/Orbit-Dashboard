"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface QuickActionProps {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional accent color for hover state; defaults to neutral. */
  color?: string;
}

/**
 * Single full-width row: subtle gray icon circle on the left, label, soft
 * shadow. Matches the calm list-style design used elsewhere in Orbit.
 */
export function QuickAction({ label, href, icon: Icon, color }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 px-6 py-4 bg-white rounded-full border border-[var(--color-border)] shadow-soft-sm transition-all hover:shadow-soft hover:-translate-y-px"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          backgroundColor: color ? `${color}1A` : "var(--color-border-light)",
        }}
      >
        <Icon
          className="h-4 w-4 transition-colors"
          style={{ color: color ?? "var(--color-ink-light)" }}
        />
      </div>
      <span className="flex-1 text-body font-semibold text-[var(--color-ink)]">{label}</span>
      <ChevronRight className="h-4 w-4 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
