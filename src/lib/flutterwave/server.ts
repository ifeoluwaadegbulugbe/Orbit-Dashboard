/**
 * Flutterwave Payments v3 - server-side helpers. Import from route handlers only.
 *
 * Each Orbit business owner provides their own Flutterwave secret key, so
 * payments land in their own Flutterwave account. We pass the key per-call
 * rather than reading from an env var.
 */

import "server-only";
import crypto from "crypto";

const BASE = "https://api.flutterwave.com/v3";

interface PaymentInitResponse {
  status: "success" | "error";
  message: string;
  data?: { link: string };
}

interface CreatePaymentLinkParams {
  /** Business owner's Flutterwave secret key (FLWSECK_TEST-... or FLWSECK-...). */
  secretKey: string;
  /** Unique reference for this payment. */
  tx_ref: string;
  /** Amount in MAJOR units of the currency (e.g. 17.00 for $17). */
  amount: number;
  /** ISO currency code: "USD", "NGN", "GHS", "KES"... */
  currency: string;
  /** Page customer returns to after payment. */
  redirectUrl: string;
  customer: {
    email: string;
    name: string;
    phonenumber?: string;
  };
  customizations: {
    title: string;
    description?: string;
  };
  /** Webhook metadata to match the right invoice. */
  meta?: Record<string, string>;
}

/** Initialize a hosted Flutterwave payment page and return the redirect URL. */
export async function createFlutterwavePaymentLink(
  params: CreatePaymentLinkParams,
): Promise<{ link: string; reference: string }> {
  const body = {
    tx_ref: params.tx_ref,
    amount: params.amount,
    currency: params.currency.toUpperCase(),
    redirect_url: params.redirectUrl,
    customer: params.customer,
    customizations: params.customizations,
    meta: params.meta ?? {},
  };

  const res = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await res.json()) as PaymentInitResponse;

  if (!res.ok || json.status !== "success" || !json.data?.link) {
    throw new Error(json.message || `Flutterwave init failed (${res.status})`);
  }

  return { link: json.data.link, reference: params.tx_ref };
}

/**
 * Verify a Flutterwave webhook signature by comparing the verif-hash header
 * to the hash this user configured in their own Flutterwave dashboard.
 * Each business owner sets their own webhook hash; we look it up per-user.
 */
export function verifyFlutterwaveHash(
  headerHash: string | null,
  expected: string | null | undefined,
): boolean {
  if (!expected || !headerHash) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(headerHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
