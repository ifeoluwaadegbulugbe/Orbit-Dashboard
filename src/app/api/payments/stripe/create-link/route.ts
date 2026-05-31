// app/api/payments/stripe/create-link/route.ts
//
// Called when an Orbit user clicks "Send payment link" on an invoice.
// The client sends the user's own Stripe secret key (read from localStorage)
// plus the invoice details. We create a Stripe Payment Link and return the URL.
//
// The client then saves that URL on the payment record so it can be copied
// and sent to the end customer.
//
// Flow:
//   Client  →  POST /api/payments/stripe/create-link  →  Stripe API
//                                                     ←  { url, paymentLinkId }
//   Client updates payment record with the link URL in the DB via its own hook.

import Stripe from "stripe";
import { NextResponse } from "next/server";

// ─── Request shape ───────────────────────────────────────────────────────────

interface CreateLinkRequest {
    /** The business owner's own Stripe secret key (from their localStorage). */
    secretKey: string;
    /** Invoice amount in the major unit of the currency (e.g. 49.99 for $49.99). */
    amount: number;
    /** ISO-4217 currency code, lowercase (e.g. "usd", "gbp", "ngn"). */
    currency: string;
    /** Orbit's internal payment record ID — stored in Stripe metadata so the
     *  webhook can find the right record when payment succeeds. */
    orbitPaymentId: string;
    /** Human-readable invoice number shown on the Stripe checkout page. */
    invoiceNumber: string;
    /** Optional — pre-fills the customer email on Stripe's checkout page. */
    clientEmail?: string;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    // 1. Parse request
    let body: CreateLinkRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { secretKey, amount, currency, orbitPaymentId, invoiceNumber, clientEmail } = body;

    // 2. Validate inputs
    if (!secretKey || !amount || !currency || !orbitPaymentId) {
        return NextResponse.json(
            { error: "Missing required fields: secretKey, amount, currency, orbitPaymentId." },
            { status: 400 }
        );
    }

    if (amount <= 0) {
        return NextResponse.json(
            { error: "Amount must be greater than zero." },
            { status: 400 }
        );
    }

    // 3. Build the Stripe client using the business owner's own key.
    //    This means the payment goes into THEIR Stripe account, not Orbit's.
    const stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });

    try {
        // 4. Create a one-time Price object.
        //    Stripe requires an amount in the *smallest currency unit* (e.g. cents).
        //    So $49.99  →  4999 cents.
        //    Zero-decimal currencies (JPY, KRW) are an exception — no multiplication.
        const ZERO_DECIMAL_CURRENCIES = new Set([
            "bif", "clp", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
            "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
        ]);
        const unitAmount = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
            ? Math.round(amount)
            : Math.round(amount * 100);

        const price = await stripe.prices.create({
            currency: currency.toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
                // This name appears on the customer's Stripe receipt
                name: invoiceNumber ? `Invoice ${invoiceNumber}` : "Invoice payment",
            },
        });

        // 5. Create the Payment Link
        //    A Payment Link is a shareable URL — the customer clicks it, fills in
        //    their card details on Stripe's hosted page, and pays.
        const linkParams: Stripe.PaymentLinkCreateParams = {
            line_items: [{ price: price.id, quantity: 1 }],
            // metadata is how the webhook knows which Orbit payment to update
            metadata: {
                orbit_payment_id: orbitPaymentId,
                orbit_invoice_number: invoiceNumber ?? "",
            },
            after_completion: {
                type: "redirect",
                redirect: {
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/payments/success?id=${orbitPaymentId}`,
                },
            },
        };

        // Pre-fill customer email if we have it
        if (clientEmail) {
            linkParams.customer_creation = "always";
        }

        const paymentLink = await stripe.paymentLinks.create(linkParams);

        // 6. Return the URL to the client
        return NextResponse.json({
            url: paymentLink.url,
            paymentLinkId: paymentLink.id,
        });
    } catch (err) {
        if (err instanceof Stripe.errors.StripeAuthenticationError) {
            return NextResponse.json(
                { error: "Stripe rejected the API key. Please reconnect your Stripe account." },
                { status: 401 }
            );
        }
        if (err instanceof Stripe.errors.StripeInvalidRequestError) {
            return NextResponse.json(
                { error: `Stripe error: ${err.message}` },
                { status: 422 }
            );
        }
        console.error("[stripe/create-link] Unexpected error:", err);
        return NextResponse.json(
            { error: "Could not create payment link. Please try again." },
            { status: 500 }
        );
    }
}
