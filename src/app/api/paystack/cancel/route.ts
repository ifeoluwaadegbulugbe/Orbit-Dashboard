import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { listCustomerSubscriptions, disableSubscription } from "@/lib/paystack/server";

/**
 * Cancels the current user's Pro subscription in one tap - no redirect to an
 * external Paystack page (keeps the payment rail invisible to the user, per
 * orbit-overhaul.md §9). Flips subscription_status to "free" immediately
 * here rather than waiting on the subscription.disable webhook, since a
 * cancel is exactly the kind of action where "did this actually work?"
 * anxiety is high - the webhook still fires and re-confirms independently.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const customerRes = await fetch(
      `https://api.paystack.co/customer/${encodeURIComponent(user.email)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, cache: "no-store" },
    );
    const customerJson = await customerRes.json();
    if (!customerJson.status) {
      return NextResponse.json({ error: "No billing record found for your account." }, { status: 404 });
    }

    const customerCode = customerJson.data.customer_code;
    const subs = await listCustomerSubscriptions(customerCode);
    const active = subs.data.find((s) => s.status === "active" || s.status === "non-renewing");
    if (!active) {
      return NextResponse.json({ error: "No active subscription to cancel." }, { status: 404 });
    }

    await disableSubscription(active.subscription_code, active.email_token);

    const service = createServiceClient();
    await service.from("profiles").update({ subscription_status: "free", trial_ends_at: null }).eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not cancel subscription";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
