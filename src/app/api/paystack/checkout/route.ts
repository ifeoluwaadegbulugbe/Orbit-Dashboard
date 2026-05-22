import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initializeSubscription } from "@/lib/paystack/server";
import { FREE_TRIAL_DAYS } from "@/lib/constants";

/** Detects placeholder env values left over from .env.local.example. */
function looksLikePlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.toLowerCase();
  return v.includes("xxxxx") || v.includes("your_") || v === "" || v.endsWith("xxxxxxxxxxxxxxx");
}

/** Marker so we can confirm the route registered when the dev server reloads. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // ── 1. Auth - wrap in try/catch so DNS errors return a clear message ──
  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You need to sign in first." }, { status: 401 });
    }
    userId = user.id;
    userEmail = user.email ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error:
          "Could not reach Supabase to verify your session. Check NEXT_PUBLIC_SUPABASE_URL in .env.local. " +
          msg,
      },
      { status: 500 },
    );
  }

  const { startTrial } = (await request.json().catch(() => ({}))) as { startTrial?: boolean };

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const planCode = process.env.NEXT_PUBLIC_PAYSTACK_PLAN_CODE;
  const amountKobo = Number(process.env.PAYSTACK_PLAN_AMOUNT_KOBO ?? 900000); // ₦9,000 ≈ $17
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── 2. Config sanity checks - fail with a CLEAR message ──
  if (looksLikePlaceholder(secretKey) || !secretKey?.startsWith("sk_")) {
    return NextResponse.json(
      {
        error:
          "Paystack isn't set up yet. Add your real PAYSTACK_SECRET_KEY (starts with sk_test_ or sk_live_) to .env.local - or set NEXT_PUBLIC_FORCE_PRO=true to test Pro features without real payment.",
        code: "PAYSTACK_KEY_MISSING",
      },
      { status: 503 },
    );
  }

  if (looksLikePlaceholder(planCode) || !planCode?.startsWith("PLN_")) {
    return NextResponse.json(
      {
        error:
          "Paystack plan not configured. Create a plan in Paystack Dashboard → Plans, then add its code (PLN_xxx…) to NEXT_PUBLIC_PAYSTACK_PLAN_CODE in .env.local. Or set NEXT_PUBLIC_FORCE_PRO=true to test Pro without real payment.",
        code: "PAYSTACK_PLAN_MISSING",
      },
      { status: 503 },
    );
  }

  if (!userEmail) {
    return NextResponse.json(
      { error: "Your account has no email on file - needed to start Paystack checkout." },
      { status: 400 },
    );
  }

  // ── 3. Try Paystack initialize ──
  try {
    const result = await initializeSubscription({
      email: userEmail,
      amountKobo,
      planCode: planCode!,
      callbackUrl: `${appUrl}/api/paystack/verify`,
      trialDays: startTrial ? FREE_TRIAL_DAYS : 0,
      metadata: {
        user_id: userId!,
        kind: startTrial ? "trial" : "subscription",
      },
    });

    return NextResponse.json({
      authorization_url: result.data.authorization_url,
      reference: result.data.reference,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkout failed";
    // Paystack returns "Invalid key" when the secret key doesn't match the mode.
    if (msg.toLowerCase().includes("invalid key")) {
      return NextResponse.json(
        {
          error:
            "Paystack rejected the API key - it looks invalid or doesn't match the plan's mode (test vs live). Double-check PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PLAN_CODE are from the same Paystack account and mode. Or set NEXT_PUBLIC_FORCE_PRO=true to skip Paystack entirely while testing.",
          code: "PAYSTACK_INVALID_KEY",
        },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
