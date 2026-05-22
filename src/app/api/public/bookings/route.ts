import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/server";

/**
 * Public booking submission. Accepts an unauthenticated POST from /book/<slug>
 * and creates a pending booking for the business owner who owns that slug.
 *
 * Auto-creates a Client record if the visitor's email/phone isn't already in
 * the owner's client list.
 *
 * POST /api/public/bookings
 *   body: {
 *     slug: string,
 *     service: string,
 *     date: "YYYY-MM-DD",
 *     time: "HH:MM",
 *     customer: { name, email?, phone? },
 *     notes?: string
 *   }
 */

interface RequestBody {
  slug?: string;
  service?: string;
  date?: string;
  time?: string;
  customer?: { name?: string; email?: string | null; phone?: string | null };
  notes?: string | null;
}

interface ProfileRow {
  id: string;
  business_type: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { slug, service, date, time, customer, notes } = body;

  // ── Validation ─────────────────────────────────────────────────────────
  if (!slug) {
    return NextResponse.json({ error: "Missing booking slug" }, { status: 400 });
  }
  if (!customer?.name?.trim()) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  }
  if (!customer.email?.trim() && !customer.phone?.trim()) {
    return NextResponse.json(
      { error: "Add at least an email or phone so the business can reach you" },
      { status: 400 },
    );
  }
  if (!date || !time) {
    return NextResponse.json({ error: "Pick a date and time" }, { status: 400 });
  }
  if (!service?.trim()) {
    return NextResponse.json({ error: "Pick a service" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── 1. Look up the business owner ──────────────────────────────────────
  const { data: profileData, error: profileErr } = await supabase
    .from("profiles")
    .select("id, business_type")
    .eq("booking_link->>slug", slug)
    .maybeSingle();

  if (profileErr) {
    console.error("[public-booking] profile lookup failed:", profileErr.message);
    return NextResponse.json(
      { error: "Could not find this business. Double-check the link." },
      { status: 404 },
    );
  }
  if (!profileData) {
    return NextResponse.json({ error: "This booking link no longer exists." }, { status: 404 });
  }

  const profile = profileData as ProfileRow;

  // ── 2. Find or create a client record for this customer ───────────────
  // Match on email first, then phone. If neither matches an existing client,
  // create a new one so the business owner sees the booking attached to a person.
  let clientId: string | null = null;
  const customerName = customer.name.trim();
  const customerEmail = customer.email?.trim() || null;
  const customerPhone = customer.phone?.trim() || null;

  if (customerEmail) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", profile.id)
      .eq("email", customerEmail)
      .maybeSingle();
    if (data?.id) clientId = data.id as string;
  }
  if (!clientId && customerPhone) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", profile.id)
      .eq("phone", customerPhone)
      .maybeSingle();
    if (data?.id) clientId = data.id as string;
  }

  if (!clientId) {
    const { data, error: createErr } = await supabase
      .from("clients")
      .insert({
        user_id: profile.id,
        name: customerName,
        phone: customerPhone ?? "",
        email: customerEmail,
        whatsapp_number: customerPhone ?? "",
        business_type: profile.business_type,
        status: "active",
        notes: null,
        last_contacted: new Date().toISOString(),
        total_paid: 0,
        outstanding_balance: 0,
      })
      .select("id")
      .single();
    if (createErr) {
      console.error("[public-booking] client create failed:", createErr.message);
      return NextResponse.json(
        { error: "Could not save your details. Try again or contact the business directly." },
        { status: 500 },
      );
    }
    clientId = (data?.id as string) ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "Could not link your booking" }, { status: 500 });
  }

  // ── 3. Create the booking ─────────────────────────────────────────────
  const combinedNotes = [
    notes?.trim() || null,
    `Submitted via booking link as ${customerName}`,
    customerEmail ? `Email: ${customerEmail}` : null,
    customerPhone ? `Phone: ${customerPhone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { error: bookingErr } = await supabase.from("bookings").insert({
    user_id: profile.id,
    client_id: clientId,
    client_name: customerName,
    title: service,
    date,
    time,
    status: "pending",
    notes: combinedNotes,
    business_type: profile.business_type,
  });

  if (bookingErr) {
    console.error("[public-booking] booking insert failed:", bookingErr.message);
    return NextResponse.json({ error: bookingErr.message }, { status: 500 });
  }

  // Fire an in-app notification so the business owner sees the booking in
  // their bell dropdown the next time they refresh.
  await notify(supabase, {
    userId: profile.id,
    type: "booking_received",
    title: `New booking from ${customerName}`,
    body: `${service} on ${date} at ${time}. Tap to review and confirm.`,
    actionUrl: `/clients/${clientId}`,
    metadata: { client_id: clientId, slug, service, date, time },
  });

  return NextResponse.json({ ok: true });
}
