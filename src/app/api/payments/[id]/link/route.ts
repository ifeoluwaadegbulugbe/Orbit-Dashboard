import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/server";
import { createOrbitPayLink } from "@/lib/orbit-pay/link";

/**
 * POST /api/payments/:id/link - make an Orbit Pay link for an invoice.
 *
 * Money never touches Orbit: the client pays through Paystack and the
 * business's share settles straight to its own bank account (its Paystack
 * subaccount). This route only prices the charge - Orbit's fee is fixed
 * here, at the owner's plan right now - and returns the client's Orbit Pay
 * page, which shows the breakdown and then opens Paystack.
 *
 *   returns { payment_link }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS: only the owner's own invoice comes back.
  const { data: payment } = await supabase
    .from("payments").select("id, user_id, amount, remaining_balance, status").eq("id", id).maybeSingle();
  if (!payment) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (payment.status === "paid") return NextResponse.json({ error: "This invoice is already marked as paid." }, { status: 409 });

  const result = await createOrbitPayLink(createServiceClient(), { id: user.id, email: user.email }, payment);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  await track(user.id, "payment_link_created", { dedupeKey: `payment_link_created:${result.chargeId}:${user.id}`, props: { plan: result.plan, fee_bearer: "client" } });
  return NextResponse.json({ payment_link: result.link });
}
