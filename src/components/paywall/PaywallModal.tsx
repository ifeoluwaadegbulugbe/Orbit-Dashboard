"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Zap, CreditCard, BarChart3, Receipt, Wand2, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSubscription } from "@/hooks/useSubscription";
import { PRO_PRICE_DISPLAY, PRO_PRICE_PERIOD, FREE_TRIAL_DAYS } from "@/lib/constants";

const FEATURES = [
  { icon: Sparkles,   label: "AI business assistant" },
  { icon: CreditCard, label: "Online payment collection" },
  { icon: BarChart3,  label: "Advanced analytics & reports" },
  { icon: Zap,        label: "Smart automations & reminders" },
  { icon: Receipt,    label: "Professional invoices & branding" },
  { icon: Wand2,      label: "Unlimited clients & exports" },
];

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional context - e.g. "You've hit the 10-client limit" */
  reason?: string;
}

export function PaywallModal({ open, onClose, reason }: PaywallModalProps) {
  const { trialUsed } = useSubscription();
  const [loading, setLoading] = useState<"trial" | "subscribe" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function handleCheckout(kind: "trial" | "subscribe") {
    setError(null);
    setLoading(kind);
    try {
      const res = await fetch("/api/paystack/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTrial: kind === "trial" }),
      });

      // Read response as text first so we can handle non-JSON error pages
      // (Next.js error overlays return HTML, which would crash res.json()).
      const text = await res.text();
      let body: { authorization_url?: string; error?: string } = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) {
          throw new Error(
            res.status === 503
              ? "Paystack isn't configured yet. Add your real Paystack keys to .env.local, or set NEXT_PUBLIC_FORCE_PRO=true to test Pro features without payment."
              : `Server returned ${res.status}. Check your Paystack and Supabase env vars in .env.local.`,
          );
        }
      }

      if (!res.ok) {
        throw new Error(body.error ?? `Checkout failed (${res.status})`);
      }
      if (!body.authorization_url) {
        throw new Error("Server didn't return a Paystack URL. Try again or check the server logs.");
      }
      // Redirect to Paystack-hosted checkout
      window.location.href = body.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setLoading(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Overlay */}
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close"
          />

          {/* Card - capped to viewport height, inner scroll if needed */}
          <motion.div
            className="relative w-full max-w-md bg-white rounded-[var(--radius-2xl)] shadow-soft-lg flex flex-col max-h-[92vh]"
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:bg-[var(--color-border-light)] transition-colors"
            >
              <X className="h-4 w-4 text-[var(--color-muted)]" />
            </button>

            {/* Scrollable inner area */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {/* Header - tighter padding */}
              <div className="px-6 pt-6 pb-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)] mb-1">
                  {reason ?? (trialUsed ? "Welcome back" : `Try Pro free for ${FREE_TRIAL_DAYS} days`)}
                </div>
                <h2 className="text-xl font-extrabold text-[var(--color-ink)] tracking-tight">
                  {trialUsed ? "Continue with Pro" : "Unlock Orbit Pro"}
                </h2>
                <p className="mt-1.5 text-[13px] text-[var(--color-ink-light)] leading-snug">
                  {trialUsed
                    ? "Your free trial has ended. Subscribe to keep all Pro features."
                    : "Everything you need to run and grow your business."}
                </p>
              </div>

              {/* Features - tighter rows */}
              <div className="px-6 pb-3">
                <div className="space-y-1.5">
                  {FEATURES.map((f) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.label} className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
                          <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                        </div>
                        <span className="text-[13px] text-[var(--color-ink)] flex-1">{f.label}</span>
                        <Icon className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Price */}
              <div className="px-6 pt-2 pb-1 flex items-baseline justify-center gap-1.5 flex-wrap">
                <span className="text-2xl font-extrabold tracking-tight text-[var(--color-ink)]">
                  {PRO_PRICE_DISPLAY}
                </span>
                <span className="text-[13px] text-[var(--color-muted)] font-medium">{PRO_PRICE_PERIOD}</span>
                {!trialUsed && (
                  <span className="ml-2 inline-flex items-center bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {FREE_TRIAL_DAYS}-day free trial
                  </span>
                )}
              </div>

              {error && (
                <div className="mx-6 mt-3 px-3 py-2.5 rounded-md bg-[var(--color-danger-light)] text-[12px] text-[var(--color-danger-deep)] leading-snug">
                  {error}
                </div>
              )}
            </div>

            {/* Sticky CTAs - never scroll away */}
            <div className="border-t border-[var(--color-border)] px-6 py-4 space-y-2 flex-shrink-0">
              {trialUsed ? (
                <Button
                  size="lg"
                  fullWidth
                  loading={loading === "subscribe"}
                  leftIcon={<Lock className="h-4 w-4" />}
                  onClick={() => handleCheckout("subscribe")}
                >
                  Subscribe - {PRO_PRICE_DISPLAY}{PRO_PRICE_PERIOD}
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    fullWidth
                    loading={loading === "trial"}
                    leftIcon={<Zap className="h-4 w-4" />}
                    onClick={() => handleCheckout("trial")}
                  >
                    Start {FREE_TRIAL_DAYS}-day free trial
                  </Button>
                  <button
                    className="w-full text-center text-[13px] font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] py-1"
                    onClick={() => handleCheckout("subscribe")}
                    disabled={loading !== null}
                  >
                    Skip trial · Subscribe now
                  </button>
                </>
              )}

              <p className="text-[10px] text-center text-[var(--color-muted)] leading-snug pt-1">
                {trialUsed
                  ? "Cancel anytime from your subscription settings."
                  : `Card required. After ${FREE_TRIAL_DAYS} days, ${PRO_PRICE_DISPLAY}${PRO_PRICE_PERIOD} auto-renews unless cancelled.`}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
