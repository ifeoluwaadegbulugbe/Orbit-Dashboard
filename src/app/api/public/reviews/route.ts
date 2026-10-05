import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyId } from "@/lib/signed-links";
import { notify } from "@/lib/notifications/server";

/**
 * POST /api/public/reviews
 * Body: { bookingId, token, rating (1-5), comment? }
 *
 * The token is the signature from the private review link, so only the
 * person the link was sent to can review that booking. One review per
 * booking (enforced by a unique index); only past, non-cancelled bookings.
 */
export async function POST(request: Request) {
  let body: { bookingId?: string; token?: string; rating?: number; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { bookingId, token } = body;
  const rating = Math.round(Number(body.rating));
  const comment = (body.comment ?? "").trim().slice(0, 1000) || null;

  if (!bookingId || !verifyId("review", bookingId, token)) {
    return NextResponse.json({ error: "This review link isn't valid." }, { status: 403 });
  }
  if (!(rating >= 1 && rating <= 5)) {
    return NextResponse.json({ error: "Pick a rating from 1 to 5 stars." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, client_id, client_name, title, date, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "This booking was cancelled." }, { status: 400 });
  }
  if (String(booking.date) > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "You can review this appointment after it happens." }, { status: 400 });
  }

  const { error } = await supabase.from("reviews").insert({
    user_id: booking.user_id,
    booking_id: booking.id,
    client_id: booking.client_id,
    client_name: booking.client_name,
    rating,
    comment,
    service: booking.title,
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "You've already reviewed this appointment - thank you!" }, { status: 409 });
    }
    console.error("[reviews] insert failed:", error.message);
    return NextResponse.json({ error: "Couldn't save your review. Please try again." }, { status: 500 });
  }

  await notify(supabase, {
    userId: booking.user_id,
    type: "review_received",
    title: `${booking.client_name} left you a ${rating}★ review`,
    body: comment ? comment.slice(0, 140) : `For ${booking.title}.`,
    actionUrl: "/booking-link",
    metadata: { booking_id: booking.id, rating },
  });

  return NextResponse.json({ ok: true });
}
