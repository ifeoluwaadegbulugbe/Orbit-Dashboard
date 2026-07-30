"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { WalletBalance, LedgerEntryWithTransaction, BankAccount, Withdrawal } from "@/types";

const KEY = "wallet";

async function parseJsonError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/**
 * Wallet balances (usually just one, in the user's chosen currency) read
 * from the `wallet_balances` view - always derived, never a stored column.
 * RLS on the underlying tables already scopes this to the caller's own
 * wallet, so no extra filtering is needed beyond the user_id match below
 * (kept for consistency with the rest of the app's hooks).
 */
export function useWalletBalances() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<WalletBalance[]>({
    queryKey: [KEY, "balances", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as WalletBalance[];
    },
  });
}

/** Most recent ledger entries for the caller's own wallet, newest first. */
export function useWalletTransactions(limit = 50) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<LedgerEntryWithTransaction[]>({
    queryKey: [KEY, "transactions", userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("id, direction, amount_minor, created_at, ledger_transactions(*)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as LedgerEntryWithTransaction[];
    },
  });
}

/** Saved withdrawal destinations for the caller's own wallet. */
export function useBankAccounts() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<BankAccount[]>({
    queryKey: [KEY, "bank-accounts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as BankAccount[];
    },
  });
}

/** Adds + verifies a bank account via the BaaS partner's name-inquiry API. */
export function useAddBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { accountNumber: string; bankCode: string }) => {
      const res = await fetch("/api/wallet/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      return res.json() as Promise<{ bankAccount: BankAccount }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "bank-accounts"] }),
  });
}

/** Withdrawal history for the caller's own wallet. */
export function useWithdrawals() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<Withdrawal[]>({
    queryKey: [KEY, "withdrawals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", userId!)
        .order("requested_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Withdrawal[];
    },
  });
}

export function useRequestWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { bankAccountId: string; amountMinor: number; currency: string }) => {
      const res = await fetch("/api/wallet/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(await parseJsonError(res));
      return res.json() as Promise<{ withdrawalId: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "withdrawals"] });
      qc.invalidateQueries({ queryKey: [KEY, "balances"] });
      qc.invalidateQueries({ queryKey: [KEY, "transactions"] });
    },
  });
}
