import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";
import { notify } from "@/lib/notifications/server";
import { zonedTimeToUtcMs, DEFAULT_TIMEZONE } from "@/lib/time/zonedTime";

/**
 * Sends appointment-reminder emails 60 / 30 / 5 minutes before each upcoming
 * booking - to the CLIENT (to cut no-shows, if they have an email on file)
 * and to the owner (their own heads-up). Designed to be hit by a cron job
 * every 5 minutes - see vercel.json. A 5-minute tick with the ±2-minute
 * match window below means every booking gets caught reliably regardless of
 * exactly when in the tick its window falls.
 *
 * Vercel Cron config (vercel.json):
 *   { "path": "/api/cron/appointment-reminders", "schedule": "*\/5 * * * *" }
 *
 * Note: Vercel's Hobby plan only supports daily cron schedules - frequent
 * ticks like this need a Pro/Team plan, or an external scheduler (e.g. a
 * GitHub Actions cron, or cron-job.org) hitting this URL every 5 minutes
 * with `Authorization: Bearer $CRON_SECRET` instead.
 */

const LEAD_TIMES_MINUTES = [60, 30, 5];

interface BookingRow {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  date: string;
  time: string;
  title: string;
  status: string;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  timezone: string | null;
}

interface ClientRow {
  id: string;
  email: string | null;
}

export async function GET(request: Request) {
  // Optional bearer-token check for cron callers
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const now = new Date();
  const horizonMinutes = Math.max(...LEAD_TIMES_MINUTES) + 5; // small slack

  // Fetch all bookings starting within the next horizonMinutes window.
  // We filter by date in SQL then by exact time client-side.
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id,user_id,client_id,client_name,date,time,title,status")
    .in("date", [today, tomorrow])
    .in("status", ["pending", "confirmed"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No upcoming bookings." });
  }

  // Need each owner's timezone BEFORE we can tell how far away their booking
  // really is - a naive date+time string means nothing without one. Fetched
  // for every candidate booking's owner, not just matches, since we don't
  // know which ones match until after this conversion.
  const candidateUserIds = Array.from(new Set((bookings as BookingRow[]).map((b) => b.user_id)));
  const { data: candidateProfiles } = await supabase
    .from("profiles")
    .select("id,email,full_name,timezone")
    .in("id", candidateUserIds);
  const profileMap = new Map<string, ProfileRow>(
    (candidateProfiles ?? []).map((p) => [p.id as string, p as ProfileRow]),
  );

  // Match each booking to a reminder window
  const toSend: { booking: BookingRow; minutesUntil: number }[] = [];
  for (const b of bookings as BookingRow[]) {
    const timezone = profileMap.get(b.user_id)?.timezone || DEFAULT_TIMEZONE;
    const eventMs = zonedTimeToUtcMs(b.date, b.time, timezone);
    if (!eventMs) continue;
    const minutesUntil = Math.round((eventMs - now.getTime()) / 60000);
    // Match to the nearest lead-time window with a 2-minute slack
    const match = LEAD_TIMES_MINUTES.find((m) => Math.abs(m - minutesUntil) <= 2);
    if (match !== undefined) {
      toSend.push({ booking: b, minutesUntil: match });
    }
  }

  if (toSend.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "Nothing in the reminder windows." });
  }

  // Client emails for just the bookings we're actually sending for
  const clientIds = Array.from(new Set(toSend.map((s) => s.booking.client_id)));
  const { data: clientRows } = await supabase.from("clients").select("id,email").in("id", clientIds);
  const clientMap = new Map<string, ClientRow>(
    (clientRows ?? []).map((c) => [c.id as string, c as ClientRow]),
  );

  // Send emails + log in-app notifications so the bell dropdown shows them too
  let sent = 0;
  const errors: string[] = [];
  for (const { booking, minutesUntil } of toSend) {
    const profile = profileMap.get(booking.user_id);
    const client = clientMap.get(booking.client_id);
    const businessName = profile?.full_name || "the business";

    // Remind the CLIENT - the higher-value reminder, cuts no-shows.
    if (client?.email) {
      const result = await sendEmail({
        to: client.email,
        subject: `Reminder: ${booking.title} in ${minutesUntil} minutes`,
        html: renderClientReminderHtml({ businessName, booking, minutesUntil }),
        text: renderClientReminderText({ businessName, booking, minutesUntil }),
      });
      if (result.ok) sent++;
      else if (!result.skipped) errors.push(`client ${booking.id}: ${result.error}`);
    }

    // Remind the OWNER - their own heads-up.
    if (profile?.email) {
      const result = await sendEmail({
        to: profile.email,
        subject: `Reminder: ${booking.title} in ${minutesUntil} minutes`,
        html: renderOwnerReminderHtml({ profile, booking, minutesUntil }),
        text: renderOwnerReminderText({ profile, booking, minutesUntil }),
      });

      if (result.ok) {
        sent++;
      } else if (!result.skipped) {
        errors.push(`owner ${booking.id}: ${result.error}`);
      }
    }

    // In-app notification - shows up in the bell dropdown.
    // We fire one per (booking, lead-time) combination; the cron's 2-minute
    // slack means each window can match at most once per booking.
    await notify(supabase, {
      userId: booking.user_id,
      type: "reminder_due",
      title: `${booking.title} in ${minutesUntil} min`,
      body: `With ${booking.client_name} at ${booking.time}.`,
      actionUrl: `/bookings`,
      metadata: {
        booking_id: booking.id,
        minutes_until: minutesUntil,
        date: booking.date,
        time: booking.time,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    sent,
    considered: toSend.length,
    errors: errors.length ? errors : undefined,
  });
}

function renderOwnerReminderHtml({
  profile, booking, minutesUntil,
}: {
  profile: ProfileRow;
  booking: BookingRow;
  minutesUntil: number;
}): string {
  const firstName = profile.full_name.split(" ")[0] || "there";
  return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A1A1A; background: #F2F1EF;">
  <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #E5E3DF;">
    <div style="font-size: 12px; font-weight: 700; color: #E8557A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Coming up in ${minutesUntil} minutes</div>
    <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 8px;">${escapeHtml(booking.title)}</h1>
    <p style="font-size: 16px; color: #3D3D3D; margin: 0 0 24px;">With <strong>${escapeHtml(booking.client_name)}</strong> at ${formatTime(booking.time)}</p>
    <p style="font-size: 14px; color: #6B6B6B; margin: 0;">Hi ${escapeHtml(firstName)}, this is your friendly Orbit reminder. Good luck with the session.</p>
  </div>
  <p style="font-size: 12px; color: #9A9893; text-align: center; margin-top: 16px;">Orbit . the CRM your business will actually use</p>
</body></html>`;
}

function renderOwnerReminderText({
  profile, booking, minutesUntil,
}: {
  profile: ProfileRow;
  booking: BookingRow;
  minutesUntil: number;
}): string {
  const firstName = profile.full_name.split(" ")[0] || "there";
  return `Hi ${firstName},

Reminder: "${booking.title}" with ${booking.client_name} starts in ${minutesUntil} minutes (${formatTime(booking.time)}).

Good luck.

- Orbit`;
}

function renderClientReminderHtml({
  businessName, booking, minutesUntil,
}: {
  businessName: string;
  booking: BookingRow;
  minutesUntil: number;
}): string {
  return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1A1A1A; background: #F2F1EF;">
  <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #E5E3DF;">
    <div style="font-size: 12px; font-weight: 700; color: #E8557A; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Coming up in ${minutesUntil} minutes</div>
    <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 8px;">${escapeHtml(booking.title)}</h1>
    <p style="font-size: 16px; color: #3D3D3D; margin: 0 0 24px;">With <strong>${escapeHtml(businessName)}</strong> at ${formatTime(booking.time)}</p>
    <p style="font-size: 14px; color: #6B6B6B; margin: 0;">Hi ${escapeHtml(booking.client_name)}, just a friendly reminder about your upcoming appointment. See you soon!</p>
  </div>
</body></html>`;
}

function renderClientReminderText({
  businessName, booking, minutesUntil,
}: {
  businessName: string;
  booking: BookingRow;
  minutesUntil: number;
}): string {
  return `Hi ${booking.client_name},

Just a friendly reminder: "${booking.title}" with ${businessName} starts in ${minutesUntil} minutes (${formatTime(booking.time)}).

See you soon!`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hr = parseInt(h, 10);
  const period = hr >= 12 ? "pm" : "am";
  return `${hr % 12 === 0 ? 12 : hr % 12}:${m ?? "00"}${period}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
