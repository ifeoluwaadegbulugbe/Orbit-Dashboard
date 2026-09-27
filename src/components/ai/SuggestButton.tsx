"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/stores/toastStore";

interface SuggestButtonProps {
  label: string;
  kind: "invoice_chase" | "client_followup" | "home_digest";
  context: Record<string, unknown>;
  /** Free users don't get real suggestions - this opens the paywall instead. */
  locked?: boolean;
  onLocked?: () => void;
}

/**
 * Small inline "Draft with AI" affordance used on Home, Clients and Money.
 * Calls the stateless /api/ai/suggest endpoint - no conversation is saved,
 * this is a one-off draft the owner can copy and send themselves.
 */
export function SuggestButton({ label, kind, context, locked, onLocked }: SuggestButtonProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (locked) {
      onLocked?.();
      return;
    }
    setLoading(true);
    setSuggestion(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, context }),
      });
      const json = (await res.json()) as { suggestion?: string; error?: string };
      if (!res.ok || !json.suggestion) throw new Error(json.error ?? "Could not generate a suggestion");
      setSuggestion(json.suggestion);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not generate a suggestion", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!suggestion) return;
    await navigator.clipboard.writeText(suggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (suggestion) {
    return (
      <div className="mt-3 p-4 rounded-[var(--radius-lg)] bg-[var(--color-primary-subtle)]/60 border border-[var(--color-primary)]/15">
        <p className="text-small text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap">{suggestion}</p>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 text-tiny font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-tiny font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="mt-3 inline-flex items-center gap-1.5 text-tiny font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {loading ? "Drafting..." : label}
    </button>
  );
}
