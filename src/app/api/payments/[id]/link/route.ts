import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initializeInvoiceCharge } from "@/lib/paystack/server";
import { appUrl } from "@/lib/app-url";
import { DEFAULT_COUNTRY, findCountryByCode } from "@/lib/countries";

/**
 * Generate a payment link for an invoice, collected into Orbit's OWN
 * Paystack account (the wallet's custody rail - see the "Custody path"
 * decision). The business owner doesn't connect anything or provide any
 * keys; the customer pays, the money lands in the owner's Orbit Wallet
 * automatically via the webhook (src/app/api/paystack/webhook), which
 * also splits off Orbit's platform fee (src/lib/wallet/fees.ts).
 *
 *   POST /api/payments/:id/link
 *     returns { payment_link, transaction_reference }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Payment links are charged by Orbit's Paystack account in Naira. An
  // invoice in another currency would be charged the same number in NGN,
  // so refuse rather than charge the wrong amount.
  const { data: owner } = await supabase.from("profiles").select("country_code").eq("id", user.id).maybeSingle();
  const currency = (findCountryByCode(owner?.country_code) ?? DEFAULT_COUNTRY).currency;
  if (currency !== "NGN") {
    return NextResponse.json(
      { error: `Online payment links only work for invoices in Naira (₦) for now. Your invoices are in ${currency}, so share your bank details and use "Mark paid" when the money arrives.` },
      { status: 400 },
    );
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name,email,phone")
    .eq("id", payment.client_id)
    .single();

  const customerEmail =
    client?.email?.trim() ||
    `${(client?.phone || "no-email").replace(/\D/g, "")}@orbit-clients.app`;

  const baseUrl = appUrl();
  const reference = `orbit_inv_${payment.id}_${Date.now()}`;

  try {
    const result = await initializeInvoiceCharge({
      email: customerEmail,
      amountKobo: Math.round((payment.amount as number) * 100),
      reference,
      callbackUrl: `${baseUrl}/payments/${payment.id}?paid=success`,
      metadata: {
        kind: "invoice",
        payment_id: payment.id,
        user_id: user.id,
        client_id: payment.client_id,
      },
    });

    const { error: updateErr } = await supabase
      .from("payments")
      .update({
        payment_link: result.data.authorization_url,
        transaction_reference: result.data.reference,
        payment_provider: "paystack",
      })
      .eq("id", payment.id);
    if (updateErr) {
      console.error("[orbit] failed to write payment_link:", updateErr);
    }

    return NextResponse.json({
      payment_link: result.data.authorization_url,
      transaction_reference: result.data.reference,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not generate link";
    console.error("[orbit] Paystack invoice link generation failed:", err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
