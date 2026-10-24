"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/stores/toastStore";

/** Refund an Orbit Pay payment in full. The money comes from the owner's own Paystack settlements. */
export function RefundButton({ paymentId }: { paymentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refund() {
    setBusy(true);
    const res = await fetch("/api/orbit-pay/refund", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    toast(res?.ok ? json.message : (json?.error ?? "Couldn't start the refund."), res?.ok ? "success" : "danger");
  }

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
      <h3 className="text-card-title font-semibold">Refund this payment</h3>
      <p className="text-small text-[var(--color-ink-light)] mt-1">
        Paystack returns the money to your client and takes it from your next settlement into your bank account.
      </p>
      {confirming ? (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button variant="danger" loading={busy} onClick={refund}>Yes, refund in full</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="mt-4"><Button variant="secondary" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirming(true)}>Refund</Button></div>
      )}
    </div>
  );
}
