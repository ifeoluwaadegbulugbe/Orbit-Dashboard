import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";
import { notify } from "@/lib/notifications/server";

/**
 * Sends appointment-reminder emails to Orbit users 30 / 15 / 5 minutes before
 * each upcoming booking. Designed to be hit by a cron job every 5 minutes.
 *
 * Vercel Cron config (vercel.json):
 *   {
 *     "crons": [
 *       { "path": "/api/cron/appointment-reminders", "schedule": "*\/5 * * * *" }
 *     ]
 *   }
 *
 * Or hit it from any cron service. Protect it with a Bearer token:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/appointment-reminders
 */

const LEAD_TIMES_MINUTES = [30, 15, 5];

interface BookingRow {
  id: string;
  user_id: string;
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
    .select("id,user_id,client_name,date,time,title,status")
    .in("date", [today, tomorrow])
    .in("status", ["pending", "confirmed"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No upcoming bookings." });
  }

  // Match each booking to a reminder window
  const toSend: { booking: BookingRow; minutesUntil: number }[] = [];
  for (const b of bookings as BookingRow[]) {
    const eventMs = parseBookingStart(b.date, b.time);
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

  // Look up the owner emails in one batch
  const userIds = Array.from(new Set(toSend.map((s) => s.booking.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .in("id", userIds);

  const profileMap = new Map<string, ProfileRow>(
    (profiles ?? []).map((p) => [p.id as string, p as ProfileRow]),
  );

  // Send emails + log in-app notifications so the bell dropdown shows them too
  let sent = 0;
  const errors: string[] = [];
  for (const { booking, minutesUntil } of toSend) {
    const profile = profileMap.get(booking.user_id);

    // Email the OWNER (their reminder, "with X at Y")
    if (profile?.email) {
      const result = await sendEmail({
        to: profile.email,
        subject: `Reminder: ${booking.title} in ${minutesUntil} minutes`,
        html: renderReminderHtml({ profile, booking, minutesUntil }),
        text: renderReminderText({ profile, booking, minutesUntil }),
      });

      if (result.ok) {
        sent++;
      } else if (!result.skipped) {
        errors.push(`${booking.id}: ${result.error}`);
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
      actionUrl: `/work?tab=calendar`,
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

function parseBookingStart(date: string, time: string): number | null {
  if (!date || !time) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function renderReminderHtml({
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

function renderReminderText({
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
