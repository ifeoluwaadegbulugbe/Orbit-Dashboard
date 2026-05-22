"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-[var(--color-ink)] mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        ref={ref}
        rows={4}
        className={cn(
          "w-full rounded-[var(--radius-md)] bg-white border border-[var(--color-border)] text-[15px] text-[var(--color-ink)] resize-y min-h-[96px]",
          "px-4 py-3 placeholder:text-[var(--color-muted)]",
          "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15",
          "transition-colors",
          error && "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/15",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--color-danger)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
});
