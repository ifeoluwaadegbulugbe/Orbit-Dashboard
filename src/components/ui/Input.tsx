"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, className, id, ...rest },
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
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full h-11 rounded-[var(--radius-md)] bg-white border border-[var(--color-border)] text-[15px] text-[var(--color-ink)]",
            "px-4 placeholder:text-[var(--color-muted)]",
            "focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15",
            "transition-colors",
            icon && "pl-10",
            error && "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/15",
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--color-danger)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
});
