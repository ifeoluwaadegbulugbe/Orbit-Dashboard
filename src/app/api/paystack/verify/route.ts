import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/paystack/server";
import { FREE_TRIAL_DAYS } from "@/lib/constants";

/**
 * Paystack's callback_url redirects here after the customer pays.
 * We verify the transaction server-side, sync the subscription status,
 * then redirect the user back into the app.
 *
 * Note: Webhook is the source of truth for ongoing renewals - this route only
 * handles the *first* sync so the UI unlocks immediately on return.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!reference) {
    return NextResponse.redirect(`${appUrl}/profile?paystack=missing_ref`);
  }

  try {
    const result = await verifyTransaction(reference);
    if (result.data.status !== "success") {
      return NextResponse.redirect(`${appUrl}/profile?paystack=failed`);
    }

    const userId = (result.data.metadata?.user_id as string | undefined) ?? null;
    const kind = (result.data.metadata?.kind as string | undefined) ?? "subscription";

    if (userId) {
      const supabase = createServiceClient();
      // For a trial-mode checkout, mark as trial. For a direct subscribe, mark as pro.
      // The webhook will keep this in sync going forward.
      if (kind === "trial") {
        const trialEndsAt = new Date(Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("profiles")
          .update({ subscription_status: "trial", trial_ends_at: trialEndsAt })
          .eq("id", userId);
      } else {
        await supabase
          .from("profiles")
          .update({ subscription_status: "pro", trial_ends_at: null })
          .eq("id", userId);
      }
    }

    return NextResponse.redirect(`${appUrl}/profile?paystack=success`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verify_failed";
    return NextResponse.redirect(`${appUrl}/profile?paystack=${encodeURIComponent(msg)}`);
  }
}
