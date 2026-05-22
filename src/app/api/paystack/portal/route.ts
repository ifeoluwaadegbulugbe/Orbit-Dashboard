import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listCustomerSubscriptions, generateManageLink } from "@/lib/paystack/server";

/**
 * Returns a hosted Paystack "manage subscription" link for the current user.
 * They can cancel, update payment method, or view billing from this page.
 *
 * This is Paystack's equivalent of Stripe's Customer Portal.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find the user's customer_code via their email
    const customerRes = await fetch(
      `https://api.paystack.co/customer/${encodeURIComponent(user.email)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, cache: "no-store" },
    );
    const customerJson = await customerRes.json();
    if (!customerJson.status) {
      return NextResponse.json({ error: "No billing record found." }, { status: 404 });
    }

    const customerCode = customerJson.data.customer_code;
    const subs = await listCustomerSubscriptions(customerCode);
    const active = subs.data.find((s) => s.status === "active" || s.status === "non-renewing");
    if (!active) {
      return NextResponse.json({ error: "No active subscription." }, { status: 404 });
    }

    const link = await generateManageLink(active.subscription_code);
    return NextResponse.json({ url: link.data.link });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Portal failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
