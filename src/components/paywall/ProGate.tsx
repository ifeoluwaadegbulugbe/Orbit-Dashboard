"use client";

import { useState, type ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { PaywallModal } from "./PaywallModal";
import { Button } from "@/components/ui/Button";

interface ProGateProps {
  /** Title to show on the locked card. */
  title: string;
  /** One-line value prop. */
  description: string;
  /** The actual Pro-only content. Rendered when user has Pro/trial access. */
  children: ReactNode;
}

/**
 * Wraps a Pro-only screen. When the user is on Free, shows a soft locked
 * overlay with an upgrade CTA. When Pro/trial, renders children normally.
 */
export function ProGate({ title, description, children }: ProGateProps) {
  const { isPro } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);

  if (isPro) return <>{children}</>;

  return (
    <>
      <div className="relative">
        {/* Dimmed preview */}
        <div className="opacity-50 pointer-events-none select-none filter blur-[1px]" aria-hidden>
          {children}
        </div>

        {/* Centered upgrade card overlaid on top */}
        <div className="absolute inset-0 flex items-center justify-center px-5">
          <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-lg p-8 max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-[var(--color-primary)]" />
            </div>
            <h3 className="text-xl font-extrabold text-[var(--color-ink)] mb-2">{title}</h3>
            <p className="text-sm text-[var(--color-ink-light)] leading-relaxed mb-6">{description}</p>
            <Button
              size="lg"
              fullWidth
              leftIcon={<Sparkles className="h-4 w-4" />}
              onClick={() => setPaywallOpen(true)}
            >
              Unlock with Pro
            </Button>
          </div>
        </div>
      </div>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  );
}
