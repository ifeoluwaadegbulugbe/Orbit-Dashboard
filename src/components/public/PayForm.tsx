"use client";

import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Amounts { service: number; fee: number; total: number } // kobo

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

type Origin = "local" | "international";

/**
 * The client's Orbit Pay page. When foreign cards are accepted the client
 * MUST say how they're paying (nothing is pre-selected and Pay stays
 * disabled until they do) - a foreign card costs more to process.
 */
export function PayForm({
  chargeId, token, business, invoiceNumber, clientPaysFee, askCardOrigin, local, international,
}: {
  chargeId: string; token: string; business: string; invoiceNumber: string | null;
  clientPaysFee: boolean; askCardOrigin: boolean; local: Amounts; international: Amounts;
}) {
  const [origin, setOrigin] = useState<Origin | null>(askCardOrigin ? null : "local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = origin === "international" ? international : local;
  const chosen = origin !== null;

  async function pay() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId, t: token, international: origin === "international" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Couldn't open the payment page.");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the payment page.");
      setBusy(false);
    }
  }

  const options: { v: Origin; title: string; sub: string }[] = [
    { v: "local", title: "Nigerian bank", sub: "Bank transfer, or a card from a Nigerian bank" },
    { v: "international", title: "Card from outside Nigeria", sub: clientPaysFee ? "Higher processing fee" : "Visa or Mastercard issued abroad" },
  ];

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6 sm:p-8">
      <p className="text-small text-[var(--color-muted)]">Pay {business}</p>
      <h1 className="text-card-title font-bold mt-1">{invoiceNumber ? `Invoice ${invoiceNumber}` : "Your invoice"}</h1>

      {askCardOrigin && (
        <fieldset className="mt-6">
          <legend className="text-body font-semibold">How are you paying?</legend>
          <div className="mt-3 grid gap-2" role="radiogroup">
            {options.map((o) => (
              <label key={o.v} className={`flex items-start gap-3 rounded-[var(--radius-lg)] border p-4 cursor-pointer transition-colors ${origin === o.v ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]" : "border-[var(--color-border)] hover:bg-[var(--color-canvas)]"}`}>
                <input type="radio" name="origin" value={o.v} checked={origin === o.v} onChange={() => setOrigin(o.v)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
                <span>
                  <span className="block text-body font-semibold">{o.title}</span>
                  <span className="block text-small text-[var(--color-ink-light)]">{o.sub}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <dl className="mt-6 space-y-3 text-body">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--color-ink-light)]">Amount</dt>
          <dd className="font-semibold tabular-nums">{naira(a.service)}</dd>
        </div>
        {clientPaysFee && (
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-ink-light)]">Processing fee</dt>
            <dd className="font-semibold tabular-nums">{chosen ? naira(a.fee) : "-"}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 pt-3 border-t border-[var(--color-border)]">
          <dt className="font-semibold">Total</dt>
          <dd className="text-lead font-bold tabular-nums">{chosen || !clientPaysFee ? naira(a.total) : "Choose above"}</dd>
        </div>
      </dl>

      {error && <p className="mt-4 text-small text-[var(--color-danger)]" role="alert">{error}</p>}

      <div className="mt-6">
        <Button fullWidth size="lg" onClick={pay} loading={busy} disabled={!chosen} leftIcon={<Lock className="h-4 w-4" />}>
          {chosen ? `Pay ${naira(a.total)}` : "Choose how you're paying"}
        </Button>
      </div>
      <p className="mt-4 flex items-start gap-2 text-tiny text-[var(--color-muted)] leading-relaxed">
        <ShieldCheck className="h-4 w-4 flex-shrink-0" />
        Card or bank transfer, processed securely by Paystack. Your payment goes to {business}.
      </p>
    </div>
  );
}
