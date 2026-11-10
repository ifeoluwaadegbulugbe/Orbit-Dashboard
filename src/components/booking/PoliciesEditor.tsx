"use client";

import { ShieldCheck } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  CANCELLATION_OPTIONS, LATENESS_OPTIONS, DEPOSIT_DEADLINE_OPTIONS, MAX_EXTRA_POLICY, EMPTY_POLICIES,
  policyLines, type BookingPolicies, type RefundRule,
} from "@/lib/booking-policies";

/**
 * Cancellation, lateness and refund rules for the booking page. Simple
 * choices, with a live preview of exactly what clients will read and
 * agree to before they can send a booking request.
 */
export function PoliciesEditor({ value, onChange }: { value?: BookingPolicies; onChange: (p: BookingPolicies) => void }) {
  const p = { ...EMPTY_POLICIES, ...value };
  const set = <K extends keyof BookingPolicies>(k: K, v: BookingPolicies[K]) => onChange({ ...p, [k]: v });
  const lines = policyLines(p);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
        <span className="text-small font-semibold">Booking policies</span>
      </div>
      <p className="text-tiny text-[var(--color-muted)] -mt-2">
        Clients see these on your booking page and must agree before they can book. They&apos;re also in their confirmation.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Cancellation notice" value={p.cancellationHours} onChange={(e) => set("cancellationHours", Number(e.target.value))}>
          {CANCELLATION_OPTIONS.map((h) => <option key={h} value={h}>{h ? `At least ${h} hours before` : "No cancellation rule"}</option>)}
        </Select>
        <Select label="Lateness" value={p.latenessMinutes} onChange={(e) => set("latenessMinutes", Number(e.target.value))}>
          {LATENESS_OPTIONS.map((m) => <option key={m} value={m}>{m ? `More than ${m} minutes late` : "No lateness rule"}</option>)}
        </Select>
        <Select label="Refunds" value={p.refunds} onChange={(e) => set("refunds", e.target.value as RefundRule)}>
          <option value="">Don&apos;t say</option>
          <option value="deposit_non_refundable">Deposits are non-refundable</option>
          <option value="refund_if_in_time">Deposit refunded if they cancel in time</option>
          <option value="no_refunds">No refunds</option>
        </Select>
        <Select label="Deposit must be paid within" value={p.depositDeadlineHours} onChange={(e) => set("depositDeadlineHours", Number(e.target.value))}
          hint="Only for services with a deposit (set on Services)">
          {DEPOSIT_DEADLINE_OPTIONS.map((h) => <option key={h} value={h}>{h ? `${h} hours of confirming` : "No deadline"}</option>)}
        </Select>
      </div>

      <Textarea
        label="Anything else? (optional)"
        placeholder="e.g. Please come with clean, product-free hair. No extra guests."
        maxLength={MAX_EXTRA_POLICY}
        value={p.extra}
        onChange={(e) => set("extra", e.target.value)}
      />

      {lines.length > 0 && (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)] px-4 py-3">
          <div className="text-tiny font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-1.5">What clients will see</div>
          <ul className="space-y-1 text-small text-[var(--color-ink-mid)] list-disc pl-4">
            {lines.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
