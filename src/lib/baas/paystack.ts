import "server-only";
import type { BaasProvider, ResolvedBankAccount, PayoutResult, VirtualAccount, AccountBalance } from "./types";

/**
 * Paystack as the custody + payout rail (see the "Custody path" decision -
 * Orbit's own Paystack balance holds collected payments; the wallet ledger
 * tracks who owns what; this adapter is what actually moves money at the
 * edges: verifying a bank account and sending a payout).
 *
 * IMPORTANT operational setup (Paystack dashboard, one-time, only you can do this):
 *   1. Settings -> Preferences -> disable OTP on transfers ("Transfers" section).
 *      Without this, every payout needs a manual OTP typed in by a human -
 *      incompatible with an automated "tap withdraw" flow.
 *   2. Make sure the Paystack account itself is fully verified/activated for
 *      live transfers (Paystack gates this behind their own KYB on your
 *      business, separate from the KYC you do on your users).
 *   3. Settings -> API Keys & Webhooks -> add transfer.success and
 *      transfer.failed as webhook events (usually on by default once a
 *      webhook URL is set, worth double-checking).
 */

const BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || json.status === false) {
    throw new Error(json.message ?? `Paystack ${path} failed`);
  }
  return json as T;
}

export interface PaystackBank {
  name: string;
  code: string;
}

/** Used by the bank-picker UI (GET /api/wallet/banks), not part of BaasProvider. */
export async function listBanks(): Promise<PaystackBank[]> {
  const res = await paystackFetch<{ status: true; data: { name: string; code: string; active: boolean }[] }>(
    "/bank?currency=NGN&country=nigeria",
  );
  return res.data.filter((b) => b.active).map((b) => ({ name: b.name, code: b.code }));
}

export class PaystackBaasProvider implements BaasProvider {
  readonly name = "paystack";
  readonly isConfigured = true;

  async resolveBankAccount(params: { accountNumber: string; bankCode: string }): Promise<ResolvedBankAccount> {
    const res = await paystackFetch<{ status: true; data: { account_number: string; account_name: string } }>(
      `/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`,
    );
    const banks = await listBanks();
    const bank = banks.find((b) => b.code === params.bankCode);
    return {
      accountNumber: res.data.account_number,
      bankCode: params.bankCode,
      bankName: bank?.name ?? params.bankCode,
      accountName: res.data.account_name,
    };
  }

  async initiatePayout(params: {
    amountMinor: number;
    currency: string;
    destination: ResolvedBankAccount;
    idempotencyKey: string;
  }): Promise<PayoutResult> {
    const recipient = await paystackFetch<{ status: true; data: { recipient_code: string } }>(
      "/transferrecipient",
      {
        method: "POST",
        body: JSON.stringify({
          type: "nuban",
          name: params.destination.accountName,
          account_number: params.destination.accountNumber,
          bank_code: params.destination.bankCode,
          currency: params.currency,
        }),
      },
    );

    const transfer = await paystackFetch<{
      status: true;
      data: { transfer_code: string; reference: string; status: "pending" | "success" | "otp" | "failed" };
    }>("/transfer", {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: params.amountMinor,
        recipient: recipient.data.recipient_code,
        reason: "Orbit wallet withdrawal",
        reference: params.idempotencyKey,
      }),
    });

    const status = transfer.data.status;
    return {
      providerReference: transfer.data.transfer_code,
      // "otp" means the transfer is stuck waiting on a manual OTP - with OTP
      // disabled per the setup notes above this shouldn't happen, but if it
      // does, treat it as still-processing rather than silently losing it.
      status: status === "success" ? "completed" : status === "failed" ? "failed" : "processing",
    };
  }

  async createVirtualAccount(params: { userId: string; currency: string }): Promise<VirtualAccount> {
    const customer = await paystackFetch<{ status: true; data: { customer_code: string } }>("/customer", {
      method: "POST",
      body: JSON.stringify({
        email: `${params.userId}@orbit-wallet.internal`,
        first_name: "Orbit",
        last_name: "User",
      }),
    });

    const account = await paystackFetch<{
      status: true;
      data: { account_number: string; bank: { name: string }; id: number };
    }>("/dedicated_account", {
      method: "POST",
      body: JSON.stringify({ customer: customer.data.customer_code }),
    });

    return {
      accountNumber: account.data.account_number,
      bankName: account.data.bank.name,
      externalRef: String(account.data.id),
    };
  }

  async getAccountBalance(): Promise<AccountBalance> {
    // Paystack has no per-user balance concept - everything sits in Orbit's
    // pooled account. This returns Orbit's overall balance for
    // reconciliation, not any one user's wallet (that's the ledger's job).
    const res = await paystackFetch<{ status: true; data: { currency: string; balance: number }[] }>("/balance");
    const ngn = res.data.find((b) => b.currency === "NGN") ?? res.data[0];
    return { balanceMinor: ngn?.balance ?? 0, currency: ngn?.currency ?? "NGN" };
  }
}
