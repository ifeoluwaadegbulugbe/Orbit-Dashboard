"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertCircle, X } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";

/**
 * Floating toast stack. Renders fixed at bottom-center. Each toast slides up
 * with a soft fade, auto-dismisses after 3s, or can be tapped to dismiss.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? Check : t.tone === "danger" ? AlertCircle : null;
          const styleByTone =
            t.tone === "success"
              ? "bg-[var(--color-ink)] text-white"
              : t.tone === "danger"
                ? "bg-[var(--color-danger)] text-white"
                : "bg-[var(--color-ink)] text-white";
          return (
            <motion.button
              key={t.id}
              onClick={() => dismiss(t.id)}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className={`pointer-events-auto inline-flex items-center gap-2.5 px-5 py-3 rounded-full shadow-soft-lg text-small font-semibold ${styleByTone}`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{t.message}</span>
              <X className="h-3.5 w-3.5 opacity-60" />
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
