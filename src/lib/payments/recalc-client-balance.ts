import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";

/**
 * Recompute a client's total_paid and outstanding_balance after a payment
 * status change. Mirrors the mobile app's recalcClientBalance behaviour.
 * Shared across all payment-provider webhooks so balances stay consistent
 * regardless of which provider the customer paid through.
 */
export async function recalcClientBalance(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
) {
  const { data: rows } = await supabase
    .from("payments")
    .select("amount,status,paid_amount,remaining_balance")
    .eq("client_id", clientId);
  if (!rows) return;

  type Row = { amount: number; status: string; paid_amount: number | null; remaining_balance: number | null };
  const typed = rows as Row[];

  const totalPaid = typed
    .filter((p) => p.status === "paid" || p.status === "partial")
    .reduce((sum, p) => sum + (p.paid_amount ?? (p.status === "paid" ? p.amount : 0)), 0);

  const outstanding = typed
    .filter((p) => p.status === "pending" || p.status === "overdue" || p.status === "partial")
    .reduce((sum, p) => {
      if (p.status === "partial") return sum + Math.max(0, p.amount - (p.paid_amount ?? 0));
      return sum + (p.amount ?? 0);
    }, 0);

  await supabase
    .from("clients")
    .update({ total_paid: totalPaid, outstanding_balance: outstanding })
    .eq("id", clientId);
}
