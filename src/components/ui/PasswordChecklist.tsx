"use client";

import { Check, Circle, AlertCircle } from "lucide-react";
import { PASSWORD_RULES, failedRules } from "@/lib/password-rules";

/** Live list under a new-password box: each rule ticks green as it's met. */
export function PasswordChecklist({ password, email }: { password: string; email?: string | null }) {
  const failed = failedRules(password, email);
  return (
    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1" aria-live="polite">
      {PASSWORD_RULES.map((r) => {
        const ok = !failed.includes(r.id);
        return (
          <li key={r.id} className={`flex items-center gap-1.5 text-tiny ${ok ? "text-[var(--color-success-deep)]" : "text-[var(--color-muted)]"}`}>
            {ok ? <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden /> : <Circle className="h-3 w-3 flex-shrink-0" aria-hidden />}
            <span>{r.label}</span>
            <span className="sr-only">{ok ? "(done)" : "(not yet)"}</span>
          </li>
        );
      })}
      {password && failed.includes("guessable") && (
        <li className="sm:col-span-2 flex items-center gap-1.5 text-tiny text-[var(--color-danger)]">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden /> Too easy to guess. Avoid common words and your email name.
        </li>
      )}
    </ul>
  );
}
