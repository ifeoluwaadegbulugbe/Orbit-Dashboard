import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";
import { depositForBooking } from "@/lib/booking-policies";
import { createOrbitPayLink } from "@/lib/orbit-pay/link";
import { ymdInZone } from "@/lib/time/ymd";
import type { BookingConfig } from "@/lib/booking-profile";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface DepositRequest {
  amount: number;
  invoiceNumber: string;
  /** Orbit Pay link, or null when Orbit Pay isn't set up (the owner collects it their own way). */
  link: string | null;
  /** Why there's no link, for the owner. */
  linkProblem?: string;
}

/**
 * When the owner confirms a booking for a service with a deposit: creates a
 * deposit invoice (type "deposit") and, if the owner uses Orbit Pay, a link
 * the client pays it with. The balance invoice is created separately (see
 * auto-invoice.ts) for the amount left after the deposit.
 *
 * Safe to call twice for the same booking - the existing deposit is reused.
 */
export async function maybeRequestDeposit(
  supabase: ServiceClient,
  booking: { id: string; user_id: string; client_id: string; client_name: string; title: string; date: string },
  owner: { id: string; email?: string | null },
): Promise<DepositRequest | null> {
  const { data: existing } = await supabase
    .from("payments").select("id, amount, invoice_number, payment_link, status")
    .eq("booking_id", booking.id).eq("type", "deposit").limit(1);
  if (existing?.[0]) {
    const d = existing[0];
    return { amount: Number(d.amount), invoiceNumber: d.invoice_number, link: d.status === "paid" ? null : d.payment_link };
  }

  const { data: profileRow } = await supabase.from("profiles").select("booking_link").eq("id", booking.user_id).maybeSingle();
  const services = (profileRow?.booking_link as BookingConfig | null)?.services ?? [];
  const amount = depositForBooking(services, booking.title);
  if (!(amount > 0)) return null;

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-D`;
  const { data: inserted, error } = await supabase.from("payments").insert({
    user_id: booking.user_id,
    client_id: booking.client_id,
    client_name: booking.client_name,
    amount,
    paid_amount: null,
    remaining_balance: amount,
    type: "deposit",
    status: "pending",
    date: ymdInZone(new Date(), "Africa/Lagos"),
    notes: `Deposit to secure ${booking.title} on ${booking.date}`,
    invoice_number: invoiceNumber,
    line_items: null,
    payment_link: null,
    transaction_reference: null,
    payment_provider: null,
    webhook_verified: null,
    payment_completed_at: null,
    booking_id: booking.id,
  }).select("id").single();
  if (error || !inserted) {
    console.error("[deposit] insert failed:", error);
    return null;
  }

  const pay = await createOrbitPayLink(supabase, owner, { id: inserted.id as string, amount });
  return pay.ok
    ? { amount, invoiceNumber, link: pay.link }
    : { amount, invoiceNumber, link: null, linkProblem: pay.error };
}
