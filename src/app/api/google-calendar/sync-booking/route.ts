import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncBookingToGoogleCalendar } from "@/lib/google-calendar/server";

/**
 * Thin wrapper so the client-side booking hooks (useCreateBooking,
 * useUpdateBookingStatus) can trigger a sync - they write directly to
 * Supabase from the browser, so they have no server context to call
 * syncBookingToGoogleCalendar() directly. Server-side booking writes
 * (public booking form, owner respond) call the helper in-process instead
 * of hitting this route.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { bookingId?: string };
  if (!body.bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: booking } = await service
    .from("bookings")
    .select("user_id")
    .eq("id", body.bookingId)
    .maybeSingle();
  if (!booking || booking.user_id !== user.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  await syncBookingToGoogleCalendar(service, body.bookingId);
  return NextResponse.json({ ok: true });
}
