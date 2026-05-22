/**
 * Lemon Squeezy server-side helpers. Each Orbit business owner provides their
 * own API key + store ID; we don't centralize payments through Orbit's account.
 *
 * Docs: https://docs.lemonsqueezy.com/api/checkouts
 */

import "server-only";
import crypto from "crypto";

const BASE = "https://api.lemonsqueezy.com/v1";

interface CreateCheckoutParams {
  /** The business owner's Lemon Squeezy API key. */
  apiKey: string;
  /** Their store ID (Settings > Stores in LS dashboard). */
  storeId: string;
  /** Optional: a "Pay what you want" variant ID. If not provided we create an inline one. */
  variantId?: string;
  /** Customer email - LS sends them a receipt. */
  email: string;
  customerName: string;
  /** Amount in the major currency unit (LS handles cents internally per variant). */
  amount: number;
  /** ISO currency, e.g. "USD". */
  currency: string;
  /** What customer sees on the checkout page. */
  productName: string;
  productDescription?: string;
  /** Where customer returns after payment. */
  redirectUrl: string;
  /** Webhook will see these as custom_data to match the right invoice. */
  customData?: Record<string, string>;
}

interface CheckoutResponse {
  data: {
    id: string;
    attributes: { url: string };
  };
}

/**
 * Create a hosted Lemon Squeezy checkout link. Returns the URL the customer
 * can pay at and a reference we can store on the invoice.
 *
 * Note: LS requires a `variantId` for the product being sold. For one-off
 * invoices, the recommended pattern is to create a "Pay-what-you-want" or
 * "$0 + custom" variant in your LS store. The business owner saves the
 * variant ID alongside their API key in /payment-settings.
 */
export async function createLemonSqueezyCheckout(
  params: CreateCheckoutParams,
): Promise<{ link: string; reference: string }> {
  const { apiKey, storeId, variantId } = params;

  if (!variantId) {
    throw new Error(
      "Lemon Squeezy variant ID is required. In your Lemon Squeezy dashboard, " +
        "create a Pay-what-you-want variant on a product, then add its ID to /payment-settings.",
    );
  }

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        custom_price: Math.round(params.amount * 100), // LS wants cents
        product_options: {
          name: params.productName,
          description: params.productDescription ?? "",
          redirect_url: params.redirectUrl,
          receipt_button_text: "View receipt",
          receipt_thank_you_note: "Thanks for paying! Powered by Orbit.",
        },
        checkout_data: {
          email: params.email,
          name: params.customerName,
          custom: params.customData ?? {},
        },
      },
      relationships: {
        store: { data: { type: "stores", id: storeId } },
        variant: { data: { type: "variants", id: variantId } },
      },
    },
  };

  const res = await fetch(`${BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await res.json()) as
    | CheckoutResponse
    | { errors?: { detail?: string; title?: string }[] };

  if (!res.ok || !("data" in json)) {
    const msg =
      ("errors" in json && json.errors?.[0]?.detail) ||
      ("errors" in json && json.errors?.[0]?.title) ||
      `Lemon Squeezy checkout failed (${res.status})`;
    throw new Error(msg);
  }

  return { link: json.data.attributes.url, reference: json.data.id };
}

/**
 * Verify a Lemon Squeezy webhook signature.
 * They sign payloads with HMAC-SHA256 using your webhook signing secret.
 * Header: x-signature
 */
export function verifyLemonSqueezySignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string,
): boolean {
  if (!signature || !webhookSecret) return false;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
