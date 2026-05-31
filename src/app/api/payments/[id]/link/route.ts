import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFlutterwavePaymentLink } from "@/lib/flutterwave/server";
import { createStripePaymentLink } from "@/lib/stripe/server";
import type { PaymentProvider } from "@/types";

/**
 * Generate a payment link for an invoice. Each Orbit business owner connects
 * their OWN merchant account (Lemon Squeezy or Flutterwave) on /payment-settings.
 * Money lands in their account, not Orbit's. We pass their keys per request.
 *
 *   POST /api/payments/:id/link
 *     body: {
 *       provider: "stripe" | "flutterwave",
 *       keys:     { ...provider-specific fields }
 *     }
 *     returns { payment_link, transaction_reference, provider }
 */

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  flutterwave: "Flutterwave",
};

interface StripeKeys {
  apiKey: string;
  storeId: string;
  variantId: string;
}

interface FlutterwaveKeys {
  secretKey: string;
}

type ProviderKeys = StripeKeys | FlutterwaveKeys;

interface RequestBody {
  provider: PaymentProvider;
  keys?: ProviderKeys;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── 1. Auth ─────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Load the payment ────────────────────────────────────────────────
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .single();
  if (payErr || !payment) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (payment.status === "paid") {
    return NextResponse.json(
      { error: "This invoice is already marked as paid." },
      { status: 409 },
    );
  }

  // ── 3. Parse request body ──────────────────────────────────────────────
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const { provider, keys } = body;
  if (provider !== "stripe" && provider !== "flutterwave") {
    return NextResponse.json(
      { error: "Connect a payment provider first in Online Payments." },
      { status: 400 },
    );
  }
  if (!keys) {
    return NextResponse.json(
      { error: `${PROVIDER_LABEL[provider]} keys are missing. Open Online Payments to add them.` },
      { status: 400 },
    );
  }

  // ── 4. Look up the client ──────────────────────────────────────────────
  const { data: client } = await supabase
    .from("clients")
    .select("name,email,phone")
    .eq("id", payment.client_id)
    .single();

  const customerEmail =
    client?.email?.trim() ||
    `${(client?.phone || "no-email").replace(/\D/g, "")}@orbit-clients.app`;
  const customerName = client?.name ?? payment.client_name ?? "Customer";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const reference = `orbit_inv_${payment.id}_${Date.now()}`;
  const description = payment.invoice_number
    ? `Invoice ${payment.invoice_number}`
    : `Invoice for ${customerName}`;

  let paymentLink: string;
  let transactionReference = reference;

  try {
    if (provider === "stripe") {
      const lsKeys = keys as StripeKeys;
      if (!lsKeys.apiKey || !lsKeys.storeId || !lsKeys.variantId) {
        return NextResponse.json(
          {
            error:
              "Lemon Squeezy needs all three values: API key, store ID, and variant ID. Add them in Online Payments.",
            code: "PROVIDER_KEYS_INCOMPLETE",
          },
          { status: 400 },
        );
      }

      const result = await createStripePaymentLink({
        apiKey: lsKeys.apiKey,
        storeId: lsKeys.storeId,
        variantId: lsKeys.variantId,
        email: customerEmail,
        customerName,
        amount: payment.amount as number,
        currency: "USD", // LS auto-converts; the merchant's payout currency is set at the store level
        productName: description,
        productDescription: payment.notes ?? undefined,
        redirectUrl: `${appUrl}/payments/${payment.id}?paid=success`,
        customData: {
          kind: "invoice",
          payment_id: payment.id,
          user_id: user.id,
          client_id: payment.client_id,
        },
      });
      paymentLink = result.link;
      transactionReference = result.reference;
    } else {
      // Flutterwave
      const fwKeys = keys as FlutterwaveKeys;
      if (!fwKeys.secretKey) {
        return NextResponse.json(
          {
            error:
              "Flutterwave needs your secret key. Add it in Online Payments.",
            code: "PROVIDER_KEYS_INCOMPLETE",
          },
          { status: 400 },
        );
      }
      if (!fwKeys.secretKey.startsWith("FLWSECK")) {
        return NextResponse.json(
          {
            error:
              "That doesn't look like a valid Flutterwave secret key (should start with FLWSECK_TEST- or FLWSECK-).",
            code: "PROVIDER_INVALID_KEY",
          },
          { status: 400 },
        );
      }

      const result = await createFlutterwavePaymentLink({
        secretKey: fwKeys.secretKey,
        tx_ref: reference,
        amount: payment.amount as number,
        currency: "NGN", // Flutterwave merchants pick their settlement currency
        redirectUrl: `${appUrl}/payments/${payment.id}?paid=success`,
        customer: {
          email: customerEmail,
          name: customerName,
          phonenumber: client?.phone,
        },
        customizations: {
          title: description,
          description: payment.notes ?? undefined,
        },
        meta: {
          kind: "invoice",
          payment_id: payment.id,
          user_id: user.id,
        },
      });
      paymentLink = result.link;
      transactionReference = result.reference;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not generate link";
    if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("unauthorized")) {
      return NextResponse.json(
        {
          error: `${PROVIDER_LABEL[provider]} rejected your key. Double-check it in Online Payments and try again.`,
          code: "PROVIDER_INVALID_KEY",
        },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── 5. Persist link + reference + provider on the payment row ──────────
  const { error: updateErr } = await supabase
    .from("payments")
    .update({
      payment_link: paymentLink,
      transaction_reference: transactionReference,
      payment_provider: provider,
    })
    .eq("id", payment.id);
  if (updateErr) {
    console.error("[orbit] failed to write payment_link:", updateErr);
  }

  return NextResponse.json({
    payment_link: paymentLink,
    transaction_reference: transactionReference,
    provider,
  });
}
