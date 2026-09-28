"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAiPanelStore } from "@/stores/aiPanelStore";
import { PaywallModal } from "@/components/paywall/PaywallModal";

/**
 * Persistent "ready to help" entry point for the AI Assistant - floats over
 * every dashboard page instead of AI being a nav destination. Free users see
 * the same button but get the upgrade prompt instead of the chat, same
 * pattern used elsewhere (Money's Wallet tab, Insights) rather than hiding
 * the feature outright.
 */
export function AiLauncherButton() {
  const { isPro } = useSubscription();
  const openPanel = useAiPanelStore((s) => s.openPanel);
  const panelOpen = useAiPanelStore((s) => s.open);
  const [paywallOpen, setPaywallOpen] = useState(false);

  if (panelOpen) return null;

  return (
    <>
      <button
        onClick={() => (isPro ? openPanel() : setPaywallOpen(true))}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white shadow-soft-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Ask Orbit AI"
        title="Ask Orbit AI"
      >
        <Sparkles className="h-6 w-6" />
      </button>
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        reason="AI Assistant is a Pro feature"
      />
    </>
  );
}
