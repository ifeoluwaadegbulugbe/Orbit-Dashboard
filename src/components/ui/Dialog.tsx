"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close"
          />
          <motion.div
            className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col bg-white rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] shadow-soft-lg overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--color-border)] flex-shrink-0">
              <h2 className="text-base font-bold text-[var(--color-ink)] min-w-0 truncate">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="p-2 -mr-1 rounded-full hover:bg-[var(--color-border-light)] flex-shrink-0">
                <X className="h-4 w-4 text-[var(--color-muted)]" />
              </button>
            </div>
            <div className="px-5 sm:px-6 py-5 overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
