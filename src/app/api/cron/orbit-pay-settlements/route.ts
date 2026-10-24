import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { listSubaccountSettlements, listSettlementTransactions } from "@/lib/orbit-pay/paystack";

/**
 * GET /api/cron/orbit-pay-settlements  (Authorization: Bearer <CRON_SECRET>)
 *
 * Twice a day (pg_cron, migration 023): for every business with Orbit Pay
 * payments not yet confirmed in their bank, ask Paystack for that
 * subaccount's payouts and mark the payments they included as settled.
 * Read-only towards Paystack; only updates Orbit's own records.
 */
export const dynamic = "force-dynamic";

const PAID_OUT = new Set(["success", "successful", "processed", "settled", "paid"]);

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: pending, error } = await supabase
    .from("orbit_pay_charges").select("id, reference, subaccount_code, paid_at")
    .eq("status", "success").is("settled_at", null).limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bySub = new Map<string, Map<string, string>>(); // subaccount -> reference -> charge id
  for (const c of pending ?? []) {
    if (!c.reference) continue;
    if (!bySub.has(c.subaccount_code)) bySub.set(c.subaccount_code, new Map());
    bySub.get(c.subaccount_code)!.set(c.reference, c.id);
  }

  let marked = 0;
  const problems: string[] = [];
  for (const [sub, refs] of bySub) {
    try {
      const settlements = await listSubaccountSettlements(sub);
      for (const s of settlements) {
        if (!PAID_OUT.has(String(s.status ?? "").toLowerCase())) continue;
        const txs = await listSettlementTransactions(s.id);
        for (const t of txs) {
          const chargeId = t.reference ? refs.get(t.reference) : undefined;
          if (!chargeId) continue;
          await supabase.from("orbit_pay_charges")
            .update({ settled_at: s.settlement_date ?? s.settled_at ?? s.updatedAt ?? new Date().toISOString(), settlement_id: s.id })
            .eq("id", chargeId).is("settled_at", null);
          refs.delete(t.reference!);
          marked++;
        }
        if (!refs.size) break;
      }
    } catch (err) {
      problems.push(`${sub}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (problems.length) console.warn("[orbit-pay-settlements]", problems);
  return NextResponse.json({ checked: bySub.size, marked, problems: problems.length });
}
