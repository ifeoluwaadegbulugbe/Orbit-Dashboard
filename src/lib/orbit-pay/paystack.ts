/**
 * Paystack calls for Orbit Pay. Parameter names checked against Paystack's
 * current API reference (paystack.com/docs/api and the official OpenAPI
 * spec, github.com/PaystackOSS/openapi):
 *
 *   GET  /bank?country=nigeria&currency=NGN        list banks
 *   GET  /bank/resolve?account_number=&bank_code=   verify an account's name
 *   POST /subaccount  { business_name, settlement_bank, account_number, percentage_charge }
 *   PUT  /subaccount/:code                          change the settlement account
 *   POST /transaction/initialize { ..., subaccount, transaction_charge, bearer }
 *        subaccount          the business's ACCT_ code - it owns the payment
 *        transaction_charge  flat amount (kobo) that goes to Orbit's main
 *                            account, overriding the subaccount's split
 *        bearer: "account"   Paystack's fee comes out of Orbit's share
 *   POST /refund { transaction, amount }
 */

import "server-only";

const BASE = "https://api.paystack.co";

export class PaystackError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new PaystackError("Payments aren't set up on the server.", 503);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) throw new PaystackError(json.message ?? `Paystack ${path} failed`, res.status);
  return json.data as T;
}

export interface Bank { name: string; code: string }

export async function listNigerianBanks(): Promise<Bank[]> {
  const banks = await call<{ name: string; code: string; active?: boolean; is_deleted?: boolean }[]>("/bank?country=nigeria&currency=NGN&perPage=200");
  return banks.filter((b) => b.active !== false && !b.is_deleted).map((b) => ({ name: b.name, code: b.code }));
}

export async function resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string; accountNumber: string }> {
  const d = await call<{ account_name: string; account_number: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  return { accountName: d.account_name, accountNumber: d.account_number };
}

/**
 * The default split only matters if a charge were ever made without our
 * per-payment transaction_charge (never, by design) - it's set to the Free
 * rate so even then Orbit isn't left paying Paystack's fee for nothing.
 */
const DEFAULT_PERCENTAGE_CHARGE = 2.5;

export async function createSubaccount(p: { businessName: string; bankCode: string; accountNumber: string; email?: string | null; userId: string }) {
  return call<{ subaccount_code: string; account_number: string; settlement_bank: string }>("/subaccount", {
    method: "POST",
    body: JSON.stringify({
      business_name: p.businessName.slice(0, 100),
      settlement_bank: p.bankCode,
      account_number: p.accountNumber,
      percentage_charge: DEFAULT_PERCENTAGE_CHARGE,
      description: "Orbit Pay",
      primary_contact_email: p.email ?? undefined,
      metadata: JSON.stringify({ orbit_user_id: p.userId }),
    }),
  });
}

export async function updateSubaccount(code: string, p: { businessName: string; bankCode: string; accountNumber: string }) {
  return call<{ subaccount_code: string }>(`/subaccount/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: JSON.stringify({ business_name: p.businessName.slice(0, 100), settlement_bank: p.bankCode, account_number: p.accountNumber }),
  });
}

export async function initializeSplitCharge(p: {
  email: string;
  chargeKobo: number;
  feeKobo: number;
  subaccountCode: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string | number | boolean | null>;
}) {
  if (!Number.isInteger(p.chargeKobo) || !Number.isInteger(p.feeKobo) || p.feeKobo >= p.chargeKobo) {
    throw new PaystackError("Invalid charge amounts", 400);
  }
  return call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: p.email,
      amount: p.chargeKobo,
      currency: "NGN",
      reference: p.reference,
      callback_url: p.callbackUrl,
      subaccount: p.subaccountCode,
      transaction_charge: p.feeKobo,
      bearer: "account",
      metadata: p.metadata,
    }),
  });
}

export async function refundTransaction(reference: string, amountKobo?: number) {
  return call<{ status?: string; transaction?: { reference: string } }>("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: reference, ...(amountKobo ? { amount: amountKobo } : {}) }),
  });
}
