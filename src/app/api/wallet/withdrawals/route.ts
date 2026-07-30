import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getBaasProvider } from "@/lib/baas";

/**
 * Request a withdrawal. Blocked entirely (503) while no BaaS partner is
 * connected - see src/lib/baas - rather than posting a ledger hold that
 * could never actually settle. Once a real provider is wired in, this
 * route should call provider.initiatePayout() after request_withdrawal()
 * succeeds, and settle_withdrawal/fail_withdrawal from that call's result
 * or its webhook confirmation.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baas = getBaasProvider();
  if (!baas.isConfigured) {
    return NextResponse.json(
      {
        error: "Withdrawals aren't live yet - Orbit hasn't connected a banking partner.",
        code: "BAAS_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    bankAccountId?: string;
    amountMinor?: number;
    currency?: string;
  };
  const { bankAccountId, amountMinor, currency } = body;
  if (!bankAccountId || !amountMinor || amountMinor <= 0) {
    return NextResponse.json({ error: "A bank account and a positive amount are required." }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: bankAccount } = await service
    .from("bank_accounts")
    .select("id, user_id, verification_status")
    .eq("id", bankAccountId)
    .single();
  if (!bankAccount || bankAccount.user_id !== user.id) {
    return NextResponse.json({ error: "Bank account not found." }, { status: 404 });
  }
  if (bankAccount.verification_status !== "verified") {
    return NextResponse.json({ error: "That bank account hasn't been verified yet." }, { status: 400 });
  }

  const { data: withdrawalId, error } = await service.rpc("request_withdrawal", {
    p_user_id: user.id,
    p_bank_account_id: bankAccountId,
    p_amount_minor: Math.round(amountMinor),
    p_currency: currency ?? "NGN",
  });

  if (error) {
    const message = error.message.includes("insufficient balance")
      ? "You don't have enough balance for this withdrawal."
      : "Could not start the withdrawal. Try again.";
    console.error("[wallet/withdrawals] request_withdrawal failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ withdrawalId });
}
