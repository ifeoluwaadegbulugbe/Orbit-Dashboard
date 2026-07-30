import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getBaasProvider, BaasNotConfiguredError } from "@/lib/baas";

/**
 * Add a withdrawal destination. account_name always comes from the BaaS
 * partner's name-inquiry API (never the client), so a saved bank account
 * can never be spoofed by editing the request body - see bank_accounts'
 * RLS in migration 007, which has no INSERT policy for `authenticated`
 * for exactly this reason.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { accountNumber?: string; bankCode?: string };
  const { accountNumber, bankCode } = body;
  if (!accountNumber || !bankCode) {
    return NextResponse.json({ error: "Account number and bank are required." }, { status: 400 });
  }

  const baas = getBaasProvider();
  try {
    const resolved = await baas.resolveBankAccount({ accountNumber, bankCode });

    const service = createServiceClient();
    const { data, error } = await service
      .from("bank_accounts")
      .insert({
        user_id: user.id,
        bank_name: resolved.bankName,
        bank_code: resolved.bankCode,
        account_number: resolved.accountNumber,
        account_name: resolved.accountName,
        verification_status: "verified",
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ bankAccount: data });
  } catch (err) {
    if (err instanceof BaasNotConfiguredError) {
      return NextResponse.json(
        {
          error: "Bank verification isn't live yet - Orbit hasn't connected a banking partner.",
          code: "BAAS_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }
    console.error("[wallet/bank-accounts] resolve failed:", err);
    return NextResponse.json(
      { error: "Could not verify that account. Double-check the details and try again." },
      { status: 502 },
    );
  }
}
