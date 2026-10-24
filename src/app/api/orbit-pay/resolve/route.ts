import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccount } from "@/lib/orbit-pay/paystack";

/**
 * POST /api/orbit-pay/resolve { bankCode, accountNumber } → { accountName }
 * Shows the owner the name the bank has on file, to confirm before saving.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { bankCode?: unknown; accountNumber?: unknown } | null;
  const bankCode = typeof body?.bankCode === "string" ? body.bankCode.trim() : "";
  const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.replace(/\D/g, "") : "";
  if (!bankCode || accountNumber.length !== 10) {
    return NextResponse.json({ error: "Pick your bank and enter your 10-digit account number." }, { status: 400 });
  }
  try {
    const { accountName } = await resolveAccount(accountNumber, bankCode);
    return NextResponse.json({ accountName });
  } catch {
    return NextResponse.json({ error: "We couldn't find that account. Check the number and bank." }, { status: 404 });
  }
}
