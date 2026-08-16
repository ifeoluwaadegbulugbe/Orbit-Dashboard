"use client";

import { useState } from "react";
import {
  Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, AlertCircle,
  Landmark, Plus, Clock,
} from "lucide-react";
import {
  useWalletBalances, useWalletTransactions,
  useBankAccounts, useAddBankAccount, useBankList,
  useWithdrawals, useRequestWithdrawal,
} from "@/hooks/useWallet";
import { relativeDate } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { ProGate } from "@/components/paywall/ProGate";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import type { LedgerEntryWithTransaction, WithdrawalStatus } from "@/types";

function formatMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

const PROVIDER_LABEL: Record<string, string> = {
  paystack: "Paystack",
  flutterwave: "Flutterwave",
  stripe: "Stripe",
};

function describeTransaction(entry: LedgerEntryWithTransaction): string {
  const tx = entry.ledger_transactions;
  const provider = typeof tx.metadata?.provider === "string" ? tx.metadata.provider : null;
  const providerLabel = provider ? (PROVIDER_LABEL[provider] ?? provider) : null;

  if (tx.type === "invoice_payment") {
    return providerLabel ? `Invoice payment received via ${providerLabel}` : "Invoice payment received";
  }
  if (tx.type === "withdrawal_hold") return "Withdrawal requested";
  if (tx.type === "withdrawal_settled") return "Withdrawal completed";
  if (tx.type === "withdrawal_reversed") return "Withdrawal reversed";
  if (tx.type === "refund") return "Refund";
  if (tx.type === "admin_adjustment") return "Adjustment";
  return tx.type.replace(/_/g, " ");
}

const WITHDRAWAL_STATUS_STYLE: Record<WithdrawalStatus, { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }> = {
  requested:  { tone: "warning", label: "Requested" },
  validated:  { tone: "warning", label: "Validated" },
  processing: { tone: "info",    label: "Processing" },
  completed:  { tone: "success", label: "Completed" },
  failed:     { tone: "danger",  label: "Failed" },
  reversed:   { tone: "neutral", label: "Reversed" },
};

export default function WalletPage() {
  return (
    <ProGate
      title="Orbit Wallet"
      description="Get paid and withdraw straight to your bank - no payment gateway to set up."
    >
      <WalletPageInner />
    </ProGate>
  );
}

function WalletPageInner() {
  const { data: balances = [], isLoading: balancesLoading, isError: balancesError } = useWalletBalances();
  const { data: transactions = [], isLoading: txLoading } = useWalletTransactions();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: withdrawals = [] } = useWithdrawals();

  const [addBankOpen, setAddBankOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page font-bold">Wallet</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          Invoice payments land here automatically. Add a verified bank account below to withdraw whenever you like.
        </p>
      </div>

      {/* Balance card(s) */}
      {balancesError ? (
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] p-8 text-center">
          <AlertCircle className="h-8 w-8 text-[var(--color-warning-deep)] mx-auto mb-3" />
          <p className="text-body font-semibold text-[var(--color-ink)]">Your wallet isn&apos;t set up yet.</p>
          <p className="text-small text-[var(--color-muted)] mt-1">
            Ask your admin to apply the wallet ledger migration.
          </p>
        </div>
      ) : balancesLoading ? (
        <div className="h-32 rounded-[var(--radius-2xl)] skeleton" />
      ) : balances.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] p-8 text-center">
          <WalletIcon className="h-8 w-8 text-[var(--color-muted)] mx-auto mb-3" />
          <p className="text-small text-[var(--color-ink-light)]">No wallet activity yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {balances.map((b) => (
            <div
              key={b.wallet_id}
              className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    {b.currency} balance
                  </span>
                  <div className="mt-2 text-stat font-bold">{formatMinor(b.balance_minor, b.currency)}</div>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex-shrink-0">
                  <WalletIcon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-[var(--color-border)] flex items-center justify-between gap-4">
                <span className="text-small text-[var(--color-muted)]">Lifetime confirmed payments</span>
                <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>Withdraw</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bank accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Bank accounts
          </h2>
          <Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddBankOpen(true)}>
            Add bank account
          </Button>
        </div>
        {bankAccounts.length === 0 ? (
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-8 text-center">
            <Landmark className="h-7 w-7 text-[var(--color-muted)] mx-auto mb-2" />
            <p className="text-small text-[var(--color-ink-light)]">No withdrawal destinations saved yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bankAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-4 px-5 py-4 bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)]"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--color-canvas)] flex items-center justify-center flex-shrink-0">
                  <Landmark className="h-4 w-4 text-[var(--color-ink-mid)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold text-[var(--color-ink)] truncate">{acc.account_name}</div>
                  <div className="text-small text-[var(--color-muted)]">{acc.bank_name} · {acc.account_number}</div>
                </div>
                <Badge tone={acc.verification_status === "verified" ? "success" : "warning"}>
                  {acc.verification_status === "verified" ? "Verified" : "Unverified"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <div>
          <h2 className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] mb-4">
            Withdrawals
          </h2>
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-5 px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-canvas)] flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-[var(--color-ink-mid)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold text-[var(--color-ink)]">
                    {formatMinor(w.amount_minor, w.currency)}
                  </div>
                  <div className="text-small text-[var(--color-muted)] mt-1">
                    {relativeDate(w.requested_at)}{w.failure_reason ? ` · ${w.failure_reason}` : ""}
                  </div>
                </div>
                <Badge tone={WITHDRAWAL_STATUS_STYLE[w.status].tone}>
                  {WITHDRAWAL_STATUS_STYLE[w.status].label}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div>
        <h2 className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] mb-4">
          Recent activity
        </h2>
        {txLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-[var(--radius-xl)] skeleton" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
            <p className="text-sm text-[var(--color-ink-light)]">No activity yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((entry) => {
              const isCredit = entry.direction === "credit";
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-5 px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: isCredit ? "var(--color-success-light)" : "var(--color-danger-light)",
                      color: isCredit ? "var(--color-success-deep)" : "var(--color-danger-deep)",
                    }}
                  >
                    {isCredit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-semibold text-[var(--color-ink)] truncate">
                      {describeTransaction(entry)}
                    </div>
                    <div className="text-small text-[var(--color-muted)] mt-1">
                      {relativeDate(entry.created_at)}
                    </div>
                  </div>
                  <div
                    className="text-body font-bold"
                    style={{ color: isCredit ? "var(--color-success-deep)" : "var(--color-danger-deep)" }}
                  >
                    {isCredit ? "+" : "-"}
                    {formatMinor(entry.amount_minor, entry.ledger_transactions.currency)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddBankAccountDialog open={addBankOpen} onClose={() => setAddBankOpen(false)} />
      <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}

// ─── Add bank account ──────────────────────────────────────────────────────

function AddBankAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const addBankAccount = useAddBankAccount();
  const { data: banks = [], isLoading: banksLoading } = useBankList();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addBankAccount.mutateAsync({ accountNumber, bankCode });
      toast("Bank account added", "success");
      setAccountNumber("");
      setBankCode("");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add bank account", "danger");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add bank account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Bank"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          disabled={banksLoading}
          required
        >
          <option value="">{banksLoading ? "Loading banks…" : "Choose your bank"}</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </Select>
        <Input
          label="Account number"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="0123456789"
          hint="We resolve the account name with your bank before saving it — never typed in by hand."
          required
        />
        <Button type="submit" fullWidth loading={addBankAccount.isPending}>
          Verify &amp; save
        </Button>
      </form>
    </Dialog>
  );
}

// ─── Withdraw ───────────────────────────────────────────────────────────────

function WithdrawDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: bankAccounts = [] } = useBankAccounts();
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const requestWithdrawal = useRequestWithdrawal();

  const verifiedAccounts = bankAccounts.filter((a) => a.verification_status === "verified");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountMinor = Math.round(parseFloat(amount) * 100);
    if (!bankAccountId || !amountMinor || amountMinor <= 0) return;
    try {
      await requestWithdrawal.mutateAsync({ bankAccountId, amountMinor, currency: "NGN" });
      toast("Withdrawal requested", "success");
      setAmount("");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not start withdrawal", "danger");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Withdraw">
      {verifiedAccounts.length === 0 ? (
        <p className="text-small text-[var(--color-ink-light)]">
          Add a verified bank account first to withdraw.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="To"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            required
          >
            <option value="">Choose a bank account</option>
            {verifiedAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name} · {a.bank_name} · {a.account_number}</option>
            ))}
          </Select>
          <Input
            label="Amount"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
          <Button type="submit" fullWidth loading={requestWithdrawal.isPending}>
            Request withdrawal
          </Button>
        </form>
      )}
    </Dialog>
  );
}
