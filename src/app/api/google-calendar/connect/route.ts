import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** GET /api/google-calendar/connect - redirects to Google's consent screen. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", APP_URL));
  }

  if (!isGoogleCalendarConfigured()) {
    const url = new URL("/booking-link", APP_URL);
    url.searchParams.set("google_calendar", "error");
    url.searchParams.set("reason", "not_configured");
    return NextResponse.redirect(url);
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildGoogleAuthUrl(state));
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
