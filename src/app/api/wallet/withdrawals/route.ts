import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getBaasProvider } from "@/lib/baas";

/**
 * Request a withdrawal. Blocked entirely (503) while no BaaS partner is
 * connected - see src/lib/baas - rather than posting a ledger hold that
 * could never actually settle.
 *
 * Once request_withdrawal() holds the funds, we call provider.initiatePayout()
 * right away. If Paystack confirms success synchronously we settle
 * immediately; if it comes back "processing" we leave the hold in place and
 * wait for the transfer.success/transfer.failed webhook (see
 * src/app/api/paystack/webhook) to finish it; if the payout call itself
 * throws (bad recipient, Paystack error, etc.) we reverse the hold right
 * away rather than leaving the user's money stuck in limbo.
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
    .select("id, user_id, verification_status, bank_name, bank_code, account_number, account_name")
    .eq("id", bankAccountId)
    .single();
  if (!bankAccount || bankAccount.user_id !== user.id) {
    return NextResponse.json({ error: "Bank account not found." }, { status: 404 });
  }
  if (bankAccount.verification_status !== "verified") {
    return NextResponse.json({ error: "That bank account hasn't been verified yet." }, { status: 400 });
  }

  const resolvedCurrency = currency ?? "NGN";
  const roundedAmount = Math.round(amountMinor);

  const { data: withdrawalId, error } = await service.rpc("request_withdrawal", {
    p_user_id: user.id,
    p_bank_account_id: bankAccountId,
    p_amount_minor: roundedAmount,
    p_currency: resolvedCurrency,
  });

  if (error) {
    const message = error.message.includes("insufficient balance")
      ? "You don't have enough balance for this withdrawal."
      : "Could not start the withdrawal. Try again.";
    console.error("[wallet/withdrawals] request_withdrawal failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // The hold is posted - now actually try to send the money.
  try {
    const payout = await baas.initiatePayout({
      amountMinor: roundedAmount,
      currency: resolvedCurrency,
      destination: {
        accountNumber: bankAccount.account_number,
        bankCode: bankAccount.bank_code,
        bankName: bankAccount.bank_name,
        accountName: bankAccount.account_name,
      },
      idempotencyKey: withdrawalId as string,
    });

    if (payout.status === "completed") {
      await service.rpc("settle_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_provider_payout_reference: payout.providerReference,
      });
    } else if (payout.status === "failed") {
      await service.rpc("fail_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_failure_reason: payout.failureReason ?? "Payout failed",
      });
    } else {
      // Still processing - just record the provider reference for
      // reconciliation; transfer.success/transfer.failed finishes this.
      await service
        .from("withdrawals")
        .update({ status: "processing", provider_payout_reference: payout.providerReference })
        .eq("id", withdrawalId);
    }
  } catch (err) {
    console.error("[wallet/withdrawals] initiatePayout failed:", err);
    await service.rpc("fail_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_failure_reason: err instanceof Error ? err.message : "Payout failed",
    });
    return NextResponse.json(
      { error: "Could not send the payout. The hold has been reversed - your balance is unaffected." },
      { status: 502 },
    );
  }

  return NextResponse.json({ withdrawalId });
}
