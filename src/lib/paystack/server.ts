/**
 * Paystack server-side client. Wraps the REST API and handles signature verification.
 * Only import from server-only contexts (route handlers, server actions).
 */

import "server-only";
import crypto from "crypto";

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

// ─── One-off invoice transactions ──────────────────────────────────────────

interface InitInvoiceResponse {
  status: true;
  data: { authorization_url: string; access_code: string; reference: string };
}

/**
 * Initialize a one-time charge for an invoice. Unlike subscriptions, this
 * doesn't include a `plan` - just the amount. Customer pays once via the
 * returned authorization_url. We listen for `charge.success` in the webhook
 * to mark the invoice as paid.
 */
export async function initializeInvoiceCharge(params: {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  return paystackFetch<InitInvoiceResponse>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
  });
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

interface InitTransactionResponse {
  status: true;
  data: { authorization_url: string; access_code: string; reference: string };
}

/**
 * Initialize a transaction for a recurring plan. Paystack will charge the
 * card once, then auto-renew on the plan's schedule.
 *
 * For a free trial: set `start_date` to (now + trial days) so the first
 * charge is delayed. The card is authorized today but billed later.
 */
export async function initializeSubscription(params: {
  email: string;
  amountKobo: number;
  planCode: string;
  callbackUrl: string;
  trialDays?: number;
  metadata?: Record<string, unknown>;
}) {
  const body: Record<string, unknown> = {
    email: params.email,
    amount: params.amountKobo,
    plan: params.planCode,
    callback_url: params.callbackUrl,
    metadata: params.metadata ?? {},
  };

  if (params.trialDays && params.trialDays > 0) {
    const startDate = new Date(Date.now() + params.trialDays * 24 * 60 * 60 * 1000);
    body.start_date = startDate.toISOString();
  }

  return paystackFetch<InitTransactionResponse>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

interface VerifyTransactionResponse {
  status: true;
  data: {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    customer: { email: string; customer_code: string };
    plan?: string;
    metadata?: Record<string, unknown>;
  };
}

export async function verifyTransaction(reference: string) {
  return paystackFetch<VerifyTransactionResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
}

interface CustomerSubscriptionsResponse {
  status: true;
  data: Array<{
    id: number;
    subscription_code: string;
    email_token: string;
    status: "active" | "non-renewing" | "attention" | "cancelled" | "complete";
    next_payment_date: string | null;
    plan: { plan_code: string; name: string; amount: number };
  }>;
}

export async function listCustomerSubscriptions(customerCode: string) {
  return paystackFetch<CustomerSubscriptionsResponse>(
    `/subscription?customer=${encodeURIComponent(customerCode)}`,
  );
}

interface ManageLinkResponse {
  status: true;
  data: { link: string };
}

/** Generate a hosted link the customer can use to manage / cancel their subscription. */
export async function generateManageLink(subscriptionCode: string) {
  return paystackFetch<ManageLinkResponse>(
    `/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`,
  );
}

// ─── Webhook signature ──────────────────────────────────────────────────────

/**
 * Verify the `x-paystack-signature` header against the raw request body.
 * Paystack signs all webhooks with HMAC-SHA512 keyed by your secret key.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");
  return computed === signature;
}
