// app/api/payments/stripe/verify/route.ts
//
// Called by the PaymentSetupWizard when the user pastes their Stripe secret key
// and clicks "Verify & connect". We try to load the Stripe account info using
// that key. If Stripe accepts it, the key is valid and we return success.
//
// IMPORTANT: We do NOT store the key here. The wizard stores it in localStorage
// on the client after this route confirms the key works. This means the key
// never touches Orbit's database.
//
// Install the Stripe SDK first:  npm install stripe

import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let secretKey: string;

  // 1. Parse the request body
  try {
    const body = await request.json();
    secretKey = body.secretKey;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  // 2. Basic format check before hitting Stripe's API
  //    Stripe secret keys always start with sk_live_ or sk_test_
  if (
    !secretKey ||
    typeof secretKey !== "string" ||
    (!secretKey.startsWith("sk_live_") && !secretKey.startsWith("sk_test_"))
  ) {
    return NextResponse.json(
      {
        error:
          "That doesn't look like a Stripe secret key. " +
          "It should start with sk_live_ or sk_test_.",
      },
      { status: 400 }
    );
  }

  // 3. Try to call Stripe with the provided key
  //    stripe.accounts.retrieve() with no arguments returns the account
  //    the key belongs to. If the key is wrong, Stripe throws a 401 error.
  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: "2024-06-20",
      // We don't want to retry on network errors during a quick validation
      maxNetworkRetries: 0,
    });

    const account = await stripe.accounts.retrieve();

    // 4. Return the account name so the wizard can show "Connected to: Acme Inc."
    return NextResponse.json({
      valid: true,
      accountName: account.business_profile?.name ?? account.email ?? "Your Stripe account",
      liveMode: secretKey.startsWith("sk_live_"),
    });
  } catch (err) {
    // Stripe's SDK throws StripeAuthenticationError (status 401) for bad keys
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      return NextResponse.json(
        {
          error:
            "Stripe rejected this key. " +
            "Double-check you copied the whole string from the Stripe dashboard.",
        },
        { status: 401 }
      );
    }

    // Any other Stripe error (rate limit, network, etc.)
    console.error("[stripe/verify] Unexpected error:", err);
    return NextResponse.json(
      {
        error:
          "Could not reach Stripe right now. " +
          "Check your internet connection and try again.",
      },
      { status: 502 }
    );
  }
}