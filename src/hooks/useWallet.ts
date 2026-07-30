"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { WalletBalance, LedgerEntryWithTransaction } from "@/types";

const KEY = "wallet";

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
