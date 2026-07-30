"use client";

import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, AlertCircle } from "lucide-react";
import { useWalletBalances, useWalletTransactions } from "@/hooks/useWallet";
import { relativeDate } from "@/lib/utils";
import type { LedgerEntryWithTransaction } from "@/types";

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
  if (tx.type === "refund") return "Refund";
  if (tx.type === "withdrawal") return "Withdrawal";
  if (tx.type === "admin_adjustment") return "Adjustment";
  return tx.type.replace(/_/g, " ");
}

export default function WalletPage() {
  const { data: balances = [], isLoading: balancesLoading, isError: balancesError } = useWalletBalances();
  const { data: transactions = [], isLoading: txLoading } = useWalletTransactions();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page font-bold">Wallet</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          A record of payments confirmed into your connected accounts. Orbit never holds this money —
          it lands straight in your own Paystack, Stripe, or Flutterwave account.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {balances.map((b) => (
            <div
              key={b.wallet_id}
              className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  {b.currency} balance
                </span>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                  <WalletIcon className="h-5 w-5" />
                </div>
              </div>
              <div className="text-stat font-bold">{formatMinor(b.balance_minor, b.currency)}</div>
              <div className="mt-2 text-small text-[var(--color-muted)]">Lifetime confirmed payments</div>
            </div>
          ))}
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
    </div>
  );
}
