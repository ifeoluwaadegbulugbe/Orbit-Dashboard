"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import type { ProjectStatus } from "@/hooks/useProjectStatus";
import { PROJECT_STATUS_LABELS } from "@/hooks/useProjectStatus";

const STATUS_ORDER: ProjectStatus[] = ["not_started", "in_progress", "delivered"];

/**
 * Three-state segmented control. Tap a segment, instant active style shifts
 * underneath with a smooth spring animation. Designed for project status.
 */
export function StatusSegmented({
  value, onChange,
}: { value: ProjectStatus; onChange: (next: ProjectStatus) => void }) {
  // Shared layoutId on the active pill makes Framer Motion animate it
  // between segments automatically.
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex p-1 rounded-full bg-[var(--color-canvas)] border border-[var(--color-border)]"
      role="radiogroup"
      aria-label="Project status"
    >
      {STATUS_ORDER.map((s) => {
        const isActive = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => {
              if (s !== value) onChange(s);
            }}
            className="relative z-10 px-4 py-2 rounded-full text-small font-semibold transition-colors duration-200 focus-visible:outline-none active:scale-[0.98]"
            style={{
              color: isActive ? "#FFFFFF" : "var(--color-ink-light)",
            }}
          >
            {isActive && (
              <motion.span
                layoutId="status-pill-active"
                className="absolute inset-0 rounded-full bg-[var(--color-primary)] -z-10"
                transition={{ type: "spring", stiffness: 360, damping: 30 }}
              />
            )}
            {PROJECT_STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
