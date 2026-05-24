import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";
import { notify } from "@/lib/notifications/server";
import {
  buildClientBirthdayEmail,
  buildOwnerBirthdayEmail,
} from "@/lib/email/booking-templates";

/**
 * Sends birthday wishes to clients whose birthday falls on today's date.
 * Designed to be called once a day (e.g. 8 AM) by a cron job.
 *
 * For each matching client it:
 *   1. Emails the client a personalised birthday wish (if they have an email).
 *   2. Sends the business owner an in-app bell notification.
 *   3. Emails the business owner a heads-up so they can follow up personally.
 *
 * Vercel Cron entry (vercel.json):
 *   { "path": "/api/cron/birthday-messages", "schedule": "0 8 * * *" }
 *
 * Protect with a Bearer token:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/birthday-messages
 */

interface ClientRow {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
}

export async function GET(request: Request) {
  // Optional bearer-token guard
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();

  // Build today's month-day suffix e.g. "-05-24"
  const today = new Date();
  const monthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;

  // Find all clients whose birthday month-day matches today (any birth year)
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, user_id, name, email, phone, whatsapp_number")
    .like("birthday", `%-${monthDay}`)
    .not("birthday", "is", null);

  if (error) {
    console.error("[birthday-messages] client query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No birthdays today." });
  }

  // Batch-load the owner profiles so we don't N+1
  const userIds = Array.from(new Set((clients as ClientRow[]).map((c) => c.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, business_name")
    .in("id", userIds);

  const profileMap = new Map<string, ProfileRow>(
    (profiles ?? []).map((p) => [p.id as string, p as ProfileRow]),
  );

  let sent = 0;
  const errors: string[] = [];

  for (const client of clients as ClientRow[]) {
    const profile = profileMap.get(client.user_id);
    if (!profile) continue;

    const businessName =
      profile.business_name?.trim() || profile.full_name?.trim() || "your business";

    const clientPhone = client.whatsapp_number || client.phone || null;

    // ── 1. Birthday wish email to the client ──────────────────────────────
    if (client.email) {
      const { subject, html, text } = buildClientBirthdayEmail({
        clientName: client.name,
        businessName,
      });
      const result = await sendEmail({ to: client.email, subject, html, text });
      if (result.ok) {
        sent++;
      } else if (!result.skipped) {
        errors.push(`client ${client.id}: ${result.error}`);
      }
    }

    // ── 2. In-app notification for the owner ──────────────────────────────
    await notify(supabase, {
      userId: client.user_id,
      type: "client_birthday",
      title: `🎂 It's ${client.name}'s birthday today!`,
      body: client.email
        ? "A birthday wish has been sent to them."
        : "They don't have an email — consider reaching out personally.",
      actionUrl: `/clients/${client.id}`,
      metadata: { client_id: client.id },
    });

    // ── 3. Heads-up email to the owner ────────────────────────────────────
    if (profile.email) {
      const { subject, html, text } = buildOwnerBirthdayEmail({
        clientName: client.name,
        businessName,
        clientEmail: client.email,
        clientPhone,
      });
      const ownerResult = await sendEmail({ to: profile.email, subject, html, text });
      if (!ownerResult.ok && !ownerResult.skipped) {
        console.warn("[birthday-messages] owner email failed:", ownerResult.error);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    considered: clients.length,
    errors: errors.length ? errors : undefined,
  });
}
