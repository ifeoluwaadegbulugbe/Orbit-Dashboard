import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

// Fallback country -> primary IANA timezone, used only when
// profiles.timezone hasn't been captured yet (accounts created before that
// existed, or the browser write in Providers.tsx never landed). Still an
// approximation - wrong for users outside a country's main zone (the US
// especially) - but profiles.timezone is now the real source of truth.
const COUNTRY_TIMEZONE: Record<string, string> = {
  NG: "Africa/Lagos",
  US: "America/New_York",
  GB: "Europe/London",
  EU: "Europe/Dublin",
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  ZA: "Africa/Johannesburg",
  KE: "Africa/Nairobi",
  GH: "Africa/Accra",
  EG: "Africa/Cairo",
  IN: "Asia/Kolkata",
  AE: "Asia/Dubai",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  PH: "Asia/Manila",
};
const DEFAULT_TIMEZONE = "UTC";

/** Fallback event length for bookings with no duration_minutes on record. */
const DEFAULT_EVENT_MINUTES = 60;

function redirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/google-calendar/callback`;
}

export function isGoogleCalendarConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Builds the URL to send the user to for Google's consent screen. */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // forces a fresh refresh_token every connect, not just the first time
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

/** Stores tokens after the OAuth callback. Upserts on user_id. */
export async function storeGoogleCalendarTokens(
  supabase: ServiceClient,
  userId: string,
  tokens: TokenResponse,
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  if (tokens.refresh_token) {
    await supabase.from("google_calendar_connections").upsert(
      {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        scope: tokens.scope,
        calendar_id: "primary",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } else {
    // Shouldn't happen with prompt=consent, but guard anyway - don't
    // clobber a previously-stored refresh_token with nothing.
    await supabase
      .from("google_calendar_connections")
      .update({ access_token: tokens.access_token, token_expires_at: expiresAt })
      .eq("user_id", userId);
  }
}

export async function isGoogleCalendarConnected(supabase: ServiceClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("google_calendar_connections")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function disconnectGoogleCalendar(supabase: ServiceClient, userId: string): Promise<void> {
  const { data: conn } = await supabase
    .from("google_calendar_connections")
    .select("access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (conn?.access_token) {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(conn.access_token)}`, { method: "POST" });
    } catch {
      // Best-effort revoke - still remove our local record either way.
    }
  }

  await supabase.from("google_calendar_connections").delete().eq("user_id", userId);
}

async function getValidAccessToken(
  supabase: ServiceClient,
  userId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const { data: conn } = await supabase
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expires_at, calendar_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) return null;

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return { accessToken: conn.access_token, calendarId: conn.calendar_id };
  }

  const refreshed = await refreshAccessToken(conn.refresh_token);
  await supabase
    .from("google_calendar_connections")
    .update({ access_token: refreshed.accessToken, token_expires_at: refreshed.expiresAt })
    .eq("user_id", userId);

  return { accessToken: refreshed.accessToken, calendarId: conn.calendar_id };
}

// ─── Calendar events ────────────────────────────────────────────────────────

/** Pure wall-clock arithmetic - deliberately NOT using Date-based timezone
 * conversion, since a naive `new Date("...")` on the server is interpreted
 * in the SERVER's local time, not the business owner's, which would corrupt
 * the event time silently. */
function addMinutesToTime(date: string, time: string, minutesToAdd: number): { date: string; time: string } {
  const [h, m] = time.split(":").map(Number);
  let totalMinutes = h * 60 + m + minutesToAdd;
  let dayOffset = 0;
  if (totalMinutes >= 24 * 60) {
    dayOffset = Math.floor(totalMinutes / (24 * 60));
    totalMinutes = totalMinutes % (24 * 60);
  }
  const newTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  if (dayOffset === 0) return { date, time: newTime };
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return { date: d.toISOString().slice(0, 10), time: newTime };
}

interface BookingForSync {
  id: string;
  user_id: string;
  client_name: string;
  title: string;
  date: string;
  time: string;
  notes: string | null;
  status: string;
  google_event_id: string | null;
  duration_minutes: number | null;
}

function buildEventBody(booking: BookingForSync, timeZone: string) {
  const minutes = booking.duration_minutes ?? DEFAULT_EVENT_MINUTES;
  const { date: endDate, time: endTime } = addMinutesToTime(booking.date, booking.time, minutes);
  return {
    summary: `${booking.title} with ${booking.client_name}`,
    description: booking.notes ?? undefined,
    start: { dateTime: `${booking.date}T${booking.time}:00`, timeZone },
    end: { dateTime: `${endDate}T${endTime}:00`, timeZone },
  };
}

async function createCalendarEvent(accessToken: string, calendarId: string, body: object): Promise<string> {
  const res = await fetch(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar create event failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: object,
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Google Calendar update event failed: ${await res.text()}`);
}

async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  // 404/410 = already gone on Google's side - treat as success, not an error.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete event failed: ${await res.text()}`);
  }
}

/**
 * The single entry point every booking write path calls. Creates, updates,
 * or deletes the matching Google Calendar event based on the booking's
 * current status. Deliberately non-throwing - a sync failure must never
 * break booking creation/confirmation/cancellation, which all work today
 * without Google Calendar.
 */
export async function syncBookingToGoogleCalendar(supabase: ServiceClient, bookingId: string): Promise<void> {
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, user_id, client_name, title, date, time, notes, status, google_event_id, duration_minutes")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;
    const b = booking as BookingForSync;

    const tokenInfo = await getValidAccessToken(supabase, b.user_id);
    if (!tokenInfo) return; // not connected - nothing to do, not an error

    const { data: profile } = await supabase
      .from("profiles")
      .select("country_code, timezone")
      .eq("id", b.user_id)
      .maybeSingle();
    const p = profile as { country_code?: string | null; timezone?: string | null } | null;
    // Real per-user timezone wins when we have it; the country-code map is
    // only a fallback for accounts from before this was captured.
    const timeZone = p?.timezone || (p?.country_code && COUNTRY_TIMEZONE[p.country_code]) || DEFAULT_TIMEZONE;

    // Only confirmed (or since-completed) bookings live on the calendar - a
    // "pending" booking hasn't been accepted yet, so it shouldn't clutter the
    // owner's calendar with a tentative hold.
    const shouldExistOnCalendar = b.status === "confirmed" || b.status === "completed";
    if (!shouldExistOnCalendar) {
      if (b.google_event_id) {
        await deleteCalendarEvent(tokenInfo.accessToken, tokenInfo.calendarId, b.google_event_id);
        await supabase.from("bookings").update({ google_event_id: null }).eq("id", bookingId);
      }
      return;
    }

    const body = buildEventBody(b, timeZone);
    if (b.google_event_id) {
      await updateCalendarEvent(tokenInfo.accessToken, tokenInfo.calendarId, b.google_event_id, body);
    } else {
      const eventId = await createCalendarEvent(tokenInfo.accessToken, tokenInfo.calendarId, body);
      await supabase.from("bookings").update({ google_event_id: eventId }).eq("id", bookingId);
    }
  } catch (err) {
    console.error("[google-calendar] sync failed for booking", bookingId, err);
  }
}
