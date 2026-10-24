"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Landmark, CheckCircle2, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/stores/toastStore";
import { createClient } from "@/lib/supabase/client";
import { ORBIT_PAY_FEES, type Plan } from "@/lib/orbit-pay/fees";
import { formatShortDate } from "@/lib/utils";
import { expectedPayoutDate, formatPayoutDate } from "@/lib/orbit-pay/payout";
import { ymdInZone } from "@/lib/time/ymd";

interface Status {
  enabled: boolean;
  available: boolean;
  plan: Plan;
  account: { bankName: string; last4: string; accountName: string } | null;
}
interface ChargeRow {
  id: string; payment_id: string; status: string; service_kobo: number; paid_kobo: number | null;
  fee_kobo: number; intl_fee_kobo: number; card_region: string | null; refunded_kobo: number; paid_at: string | null;
  settled_at: string | null;
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

export function feeText(plan: Plan): string {
  const r = ORBIT_PAY_FEES.local[plan];
  return `${r.rate * 100}% + ₦${r.fixedKobo / 100} per payment, capped at ₦${((r.capKobo ?? 0) / 100).toLocaleString("en-NG")}`;
}

/**
 * Money → Orbit Pay. Connect the bank account payments settle into, choose
 * who pays the processing fee, and see payments received. There is no
 * balance: Paystack pays each business directly.
 */
export function OrbitPayPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    fetch("/api/orbit-pay/account").then((r) => (r.ok ? r.json() : Promise.reject())).then(setStatus).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  if (error) return <Card><p className="text-small text-[var(--color-muted)]">Orbit Pay isn&apos;t available right now. Try again later.</p></Card>;
  if (!status) return <div className="h-40 rounded-[var(--radius-2xl)] skeleton" />;
  if (!status.available) return <Card><p className="text-small text-[var(--color-ink-light)]">Orbit Pay is only available for businesses in Nigeria for now. You can still send invoices and mark them paid.</p></Card>;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-card-title font-semibold">Orbit Pay</h3>
            <p className="text-small text-[var(--color-ink-light)] mt-1 leading-relaxed">
              Clients pay deposits and invoices by card or bank transfer. Payments are processed by Paystack and settle
              straight into your own bank account. Orbit never holds your money. The processing fee is added to your
              client&apos;s total as a separate line, so you receive the full invoice amount.
            </p>
            <p className="text-small font-semibold text-[var(--color-ink)] mt-2">Payments reach your bank the next business day.</p>
            <p className="text-small text-[var(--color-ink-mid)] mt-2">
              Your fee on {status.plan === "pro" ? "Pro" : "Free"}: <strong>{feeText(status.plan)}</strong>
              {status.plan === "free" && <> · Pro: {feeText("pro")}</>}
            </p>
          </div>
        </div>
      </Card>

      {!status.enabled ? (
        <Card>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-[var(--color-muted)] flex-shrink-0 mt-0.5" />
            <p className="text-small text-[var(--color-ink-light)]">
              Orbit Pay is almost ready. Until then, share your bank details with clients and tap <strong>Mark paid</strong> on an invoice when the money arrives.
            </p>
          </div>
        </Card>
      ) : !status.account || editing ? (
        <BankForm onDone={() => { setEditing(false); load(); }} onCancel={status.account ? () => setEditing(false) : undefined} />
      ) : (
        <>
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <Landmark className="h-5 w-5 text-[var(--color-success-deep)] flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">Payments settle into</p>
                  <p className="text-body font-semibold mt-1 truncate">{status.account.accountName}</p>
                  <p className="text-small text-[var(--color-ink-light)]">{status.account.bankName} · ••••{status.account.last4}</p>
                  <p className="text-tiny text-[var(--color-muted)] mt-1">Payments reach this account the next business day.</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Change</Button>
            </div>
          </Card>
        </>
      )}

      <PaymentsReceived />
    </div>
  );
}

function BankForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolved, setResolved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orbit-pay/banks").then((r) => r.json()).then((j) => setBanks(j.banks ?? [])).catch(() => setErr("Couldn't load banks."));
  }, []);

  async function post(url: string, body: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      return json;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="text-card-title font-semibold">Where should clients&apos; payments go?</h3>
      <p className="text-small text-[var(--color-ink-light)] mt-1">Use a Nigerian bank account in your name or your business&apos;s name. Payments reach it the next business day.</p>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <select value={bankCode} onChange={(e) => { setBankCode(e.target.value); setResolved(null); }} className={inputCls} aria-label="Bank">
          <option value="">Choose your bank</option>
          {banks.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
        </select>
        <input inputMode="numeric" maxLength={10} placeholder="10-digit account number" value={accountNumber}
          onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "")); setResolved(null); }} className={inputCls} aria-label="Account number" />
      </div>

      {resolved ? (
        <div className="mt-4 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] p-4">
          <p className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">The bank says this account belongs to</p>
          <p className="text-body font-bold mt-1">{resolved}</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <Button loading={busy} leftIcon={<CheckCircle2 className="h-4 w-4" />}
              onClick={async () => { if (await post("/api/orbit-pay/account", { bankCode, accountNumber, confirmedName: resolved })) { toast("Orbit Pay is set up.", "success"); onDone(); } }}>
              Yes, this is my account
            </Button>
            <Button variant="ghost" onClick={() => setResolved(null)}>No, change it</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button disabled={!bankCode || accountNumber.length !== 10} loading={busy}
            onClick={async () => { const j = await post("/api/orbit-pay/resolve", { bankCode, accountNumber }); if (j?.accountName) setResolved(j.accountName); }}>
            Check account
          </Button>
          {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        </div>
      )}
      {err && <p className="mt-3 text-small text-[var(--color-danger)]" role="alert">{err}</p>}
    </Card>
  );
}

function PaymentsReceived() {
  const [rows, setRows] = useState<ChargeRow[] | null>(null);
  useEffect(() => {
    createClient().from("orbit_pay_charges")
      .select("id, payment_id, status, service_kobo, paid_kobo, fee_kobo, intl_fee_kobo, card_region, refunded_kobo, paid_at, settled_at")
      .in("status", ["success", "refunded", "partially_refunded", "disputed"])
      .order("paid_at", { ascending: false }).limit(50)
      .then(({ data }) => setRows((data as ChargeRow[] | null) ?? []), () => setRows([]));
  }, []);

  return (
    <Card>
      <h3 className="text-card-title font-semibold">Payments received</h3>
      <p className="text-small text-[var(--color-muted)] mt-1">Paystack pays each one into your bank account the next business day.</p>
      {rows === null ? <div className="mt-4 h-20 rounded-[var(--radius-lg)] skeleton" /> : rows.length === 0 ? (
        <p className="mt-4 text-small text-[var(--color-ink-light)]">No Orbit Pay payments yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-border-light)]">
          {rows.map((r) => {
            const fee = r.card_region === "international" ? r.intl_fee_kobo : r.fee_kobo;
            const paid = Number(r.paid_kobo ?? 0);
            return (
              <li key={r.id}>
                <Link href={`/payments/${r.payment_id}`} className="flex items-center justify-between gap-4 py-3 hover:opacity-80">
                  <span className="min-w-0">
                    <span className="block text-body font-semibold tabular-nums">{naira(paid)}</span>
                    <span className="block text-tiny text-[var(--color-muted)]">
                      {r.paid_at ? formatShortDate(r.paid_at) : ""} · Orbit Pay fee {naira(Number(fee))} · To your bank {naira(paid - Number(fee))}
                    </span>
                  </span>
                  {r.status !== "success" ? (
                    <Badge tone={r.status === "disputed" ? "danger" : "neutral"}>
                      {r.status === "disputed" ? "Disputed" : r.status === "refunded" ? "Refunded" : `Refunded ${naira(Number(r.refunded_kobo))}`}
                    </Badge>
                  ) : <PayoutStatus paidAt={r.paid_at} settledAt={r.settled_at} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** "Paid to your bank" once Paystack confirms it; until then, the expected day. */
function PayoutStatus({ paidAt, settledAt }: { paidAt: string | null; settledAt: string | null }) {
  if (settledAt) return <Badge tone="success">Paid to your bank</Badge>;
  if (!paidAt) return null;
  const due = expectedPayoutDate(paidAt);
  const today = ymdInZone(new Date(), "Africa/Lagos");
  const label = formatPayoutDate(due).replace(/^([A-Za-z]{3})[A-Za-z]*/, "$1"); // "Mon 26 Oct"
  return today > due
    ? <Badge tone="warning">Due {label}</Badge>
    : <Badge tone="info">Arriving {label}</Badge>;
}

const inputCls = "w-full h-11 px-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white text-body text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)]";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">{children}</div>;
}
