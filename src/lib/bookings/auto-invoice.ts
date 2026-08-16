import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";
import { computeServiceAmount } from "@/lib/services/price";

type ServiceClient = ReturnType<typeof createServiceClient>;

interface BookingForInvoice {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  title: string;
  date: string;
}

interface AutoInvoiceResult {
  created: boolean;
  invoiceNumber?: string;
  amount?: number;
}

/**
 * Creates an invoice for a confirmed booking when its title cleanly
 * resolves to configured service(s) with parseable prices - see
 * computeServiceAmount. Never fabricates an amount: if the booking used a
 * freehand title, or a service with a non-numeric price ("From N5,000"
 * style edge cases aside - see price.ts), this quietly does nothing and
 * the owner creates the invoice by hand, same as before this existed.
 *
 * Deduped on booking_id - safe to call more than once for the same booking.
 */
export async function maybeCreateInvoiceForBooking(
  supabase: ServiceClient,
  booking: BookingForInvoice,
): Promise<AutoInvoiceResult> {
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (existing) return { created: false };

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("booking_link")
    .eq("id", booking.user_id)
    .maybeSingle();
  const services =
    (profileRow?.booking_link as { services?: { name: string; price: string }[] } | null)?.services ?? [];

  const amount = computeServiceAmount(services, booking.title);
  if (amount === null) return { created: false };

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

  const { error } = await supabase.from("payments").insert({
    user_id: booking.user_id,
    client_id: booking.client_id,
    client_name: booking.client_name,
    amount,
    paid_amount: null,
    remaining_balance: amount,
    type: "full",
    status: "pending",
    date: booking.date,
    notes: null,
    invoice_number: invoiceNumber,
    line_items: null,
    payment_link: null,
    transaction_reference: null,
    payment_provider: null,
    webhook_verified: null,
    payment_completed_at: null,
    booking_id: booking.id,
  });
  if (error) {
    console.error("[auto-invoice] insert failed:", error);
    return { created: false };
  }

  return { created: true, invoiceNumber, amount };
}
