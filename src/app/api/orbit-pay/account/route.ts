import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createSubaccount, listNigerianBanks, resolveAccount, updateSubaccount } from "@/lib/orbit-pay/paystack";
import { orbitPayCountryOk, orbitPayEnabled, planFor } from "@/lib/orbit-pay/server";

/**
 * Orbit Pay settings for the signed-in owner.
 *
 *   GET   → { enabled, available, plan, account: { bankName, last4, accountName, feeBearer } | null }
 *   POST  { bankCode, accountNumber, confirmedName } → connect or change the payout bank
 *         The account is re-checked with Paystack here (never trusting the
 *         browser) and must match the name the owner confirmed.
 *   PATCH { feeBearer: "merchant" | "client" } → who pays the processing fee
 */

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = createServiceClient();
  const [{ data: profile }, { data: acct }] = await Promise.all([
    service.from("profiles").select("email, country_code, subscription_status, trial_ends_at").eq("id", user.id).maybeSingle(),
    service.from("orbit_pay_accounts").select("bank_name, account_last4, account_name, fee_bearer").eq("user_id", user.id).maybeSingle(),
  ]);
  return NextResponse.json({
    enabled: orbitPayEnabled(),
    available: orbitPayCountryOk(profile?.country_code),
    plan: planFor({ ...profile, email: profile?.email ?? user.email }),
    account: acct ? { bankName: acct.bank_name, last4: acct.account_last4, accountName: acct.account_name, feeBearer: acct.fee_bearer } : null,
  });
}

export async function POST(request: Request) {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orbitPayEnabled()) return NextResponse.json({ error: "Orbit Pay isn't switched on yet." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { bankCode?: unknown; accountNumber?: unknown; confirmedName?: unknown } | null;
  const bankCode = typeof body?.bankCode === "string" ? body.bankCode.trim() : "";
  const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.replace(/\D/g, "") : "";
  const confirmedName = typeof body?.confirmedName === "string" ? body.confirmedName.trim() : "";
  if (!bankCode || accountNumber.length !== 10 || !confirmedName) {
    return NextResponse.json({ error: "Pick your bank, enter your account number and confirm the account name." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("business_name, full_name, email, country_code").eq("id", user.id).maybeSingle();
  if (!orbitPayCountryOk(profile?.country_code)) {
    return NextResponse.json({ error: "Orbit Pay is only available for businesses in Nigeria for now." }, { status: 400 });
  }

  let accountName: string;
  try {
    ({ accountName } = await resolveAccount(accountNumber, bankCode));
  } catch {
    return NextResponse.json({ error: "We couldn't find that account. Check the number and bank." }, { status: 404 });
  }
  if (accountName.trim().toUpperCase() !== confirmedName.toUpperCase()) {
    return NextResponse.json({ error: "The account name changed. Check it again and confirm." }, { status: 409 });
  }
  const bankName = (await listNigerianBanks().catch(() => [])).find((b) => b.code === bankCode)?.name ?? bankCode;
  const businessName = profile?.business_name?.trim() || profile?.full_name?.trim() || accountName;

  const { data: existing } = await service.from("orbit_pay_accounts").select("subaccount_code").eq("user_id", user.id).maybeSingle();
  let subaccountCode: string;
  try {
    if (existing?.subaccount_code) {
      await updateSubaccount(existing.subaccount_code, { businessName, bankCode, accountNumber });
      subaccountCode = existing.subaccount_code;
    } else {
      subaccountCode = (await createSubaccount({ businessName, bankCode, accountNumber, email: profile?.email ?? user.email, userId: user.id })).subaccount_code;
    }
  } catch (err) {
    console.error("[orbit-pay/account] Paystack subaccount failed:", err);
    return NextResponse.json({ error: "Paystack couldn't set up payouts to this account. Try again, or use a different account." }, { status: 502 });
  }

  const { error } = await service.from("orbit_pay_accounts").upsert({
    user_id: user.id,
    subaccount_code: subaccountCode,
    bank_code: bankCode,
    bank_name: bankName,
    account_last4: accountNumber.slice(-4),
    account_name: accountName,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) {
    console.error("[orbit-pay/account] save failed:", error);
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, account: { bankName, last4: accountNumber.slice(-4), accountName } });
}

export async function PATCH(request: Request) {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { feeBearer?: unknown } | null;
  if (body?.feeBearer !== "merchant" && body?.feeBearer !== "client") {
    return NextResponse.json({ error: "Choose who pays the processing fee." }, { status: 400 });
  }
  const { data, error } = await createServiceClient().from("orbit_pay_accounts")
    .update({ fee_bearer: body.feeBearer, updated_at: new Date().toISOString() })
    .eq("user_id", user.id).select("user_id");
  if (error) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Add your bank account first." }, { status: 412 });
  return NextResponse.json({ ok: true, feeBearer: body.feeBearer });
}
