import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/server";
import { sendEmail } from "@/lib/email/server";
import {
  buildConfirmEmail,
  buildCancelEmail,
  buildOwnerConfirmEmail,
  buildOwnerCancelEmail,
  buildWhatsAppUrl,
} from "@/lib/email/booking-templates";

/**
 * Owner-side endpoint that the BookingActions buttons call when the business
 * owner confirms or declines a pending booking.
 *
 * Does three things in one round-trip:
 *  1. Flips the booking's status (confirmed / cancelled).
 *  2. Sends a confirmation email to the client if they have one on file.
 *  3. Returns a wa.me URL the browser can open so the owner can send the
 *     same message via WhatsApp with a single tap.
 *
 * Also writes a booking_confirmed / booking_cancelled notification to the
 * owner's bell dropdown so there's an audit trail.
 *
 * POST /api/bookings/[id]/respond
 *   body: { status: "confirmed" | "cancelled" }
 */

interface RequestBody {
  status?: "confirmed" | "cancelled";
}

interface BookingRow {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  title: string;
  date: string;
  time: string;
  status: string;
}

interface ClientRow {
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
}

interface ProfileRow {
  full_name: string | null;
  business_name: string | null;
  email: string | null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = body.status;
  if (action !== "confirmed" && action !== "cancelled") {
    return NextResponse.json(
      { error: 'status must be "confirmed" or "cancelled"' },
      { status: 400 },
    );
  }

  // ── Auth - confirm this is the owner (not a random caller) ─────────────
  // We use the request-scoped Supabase client which honors the user's auth
  // cookie, then we double-check the booking belongs to them.
  const userClient = await createClient();
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ error: "Sign in to respond to bookings" }, { status: 401 });
  }
  const userId = authData.user.id;

  // ── Load the booking - the service client bypasses RLS so we can read
  // related rows in one place ─────────────────────────────────────────────
  const supabase = createServiceClient();

  const { data: bookingData, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, user_id, client_id, client_name, title, date, time, status")
    .eq("id", id)
    .maybeSingle();
  if (bookingErr) {
    return NextResponse.json({ error: bookingErr.message }, { status: 500 });
  }
  if (!bookingData) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const booking = bookingData as BookingRow;
  if (booking.user_id !== userId) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }

  // ── Update status ──────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({ status: action })
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // ── Look up client contact info + owner's business name ────────────────
  const [{ data: clientRow }, { data: profileRow }] = await Promise.all([
    supabase
      .from("clients")
      .select("email, phone, whatsapp_number")
      .eq("id", booking.client_id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, business_name, email")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const client = (clientRow as ClientRow | null) ?? null;
  const profile = (profileRow as ProfileRow | null) ?? null;

  const businessName =
    profile?.business_name?.trim() ||
    profile?.full_name?.trim() ||
    "your business";

  const messageParams = {
    clientName: booking.client_name,
    businessName,
    service: booking.title,
    date: booking.date,
    time: booking.time,
    ownerEmail: profile?.email ?? undefined,
    clientEmail: client?.email ?? null,
    clientPhone: client?.whatsapp_number || client?.phone || null,
  };

  // ── Email the client if we have an address ─────────────────────────────
  let emailSent = false;
  let emailError: string | null = null;
  if (client?.email) {
    const { subject, html, text } =
      action === "confirmed"
        ? buildConfirmEmail(messageParams)
        : buildCancelEmail(messageParams);

    const result = await sendEmail({ to: client.email, subject, html, text });
    if (result.ok) {
      emailSent = true;
    } else if (!result.skipped) {
      emailError = result.error ?? "Email failed";
      console.warn("[booking-respond] client email failed:", emailError);
    }
  }

  // ── Email the owner a copy of the confirmation / cancellation ──────────
  if (profile?.email) {
    const { subject, html, text } =
      action === "confirmed"
        ? buildOwnerConfirmEmail(messageParams)
        : buildOwnerCancelEmail(messageParams);

    const ownerResult = await sendEmail({ to: profile.email, subject, html, text });
    if (!ownerResult.ok && !ownerResult.skipped) {
      console.warn("[booking-respond] owner email failed:", ownerResult.error);
    }
  }

  // ── Build a wa.me URL the browser can open in a new tab ────────────────
  // Prefer whatsapp_number if explicitly set, fall back to phone.
  const whatsappTarget = client?.whatsapp_number || client?.phone || null;
  const whatsappUrl = buildWhatsAppUrl(whatsappTarget, messageParams, action === "confirmed" ? "confirm" : "cancel");

  // ── Log the event in the bell dropdown so the owner sees an audit trail
  await notify(supabase, {
    userId,
    type: action === "confirmed" ? "booking_confirmed" : "booking_cancelled",
    title:
      action === "confirmed"
        ? `You confirmed ${booking.client_name}'s booking`
        : `You cancelled ${booking.client_name}'s booking`,
    body: `${booking.title} on ${booking.date} at ${booking.time}.${emailSent ? " Email sent to client." : ""}`,
    actionUrl: `/clients/${booking.client_id}`,
    metadata: {
      booking_id: booking.id,
      action,
      email_sent: emailSent,
      whatsapp_available: !!whatsappUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    status: action,
    emailSent,
    emailError,
    whatsappUrl,
    clientHasEmail: !!client?.email,
    clientHasPhone: !!whatsappTarget,
  });
}
