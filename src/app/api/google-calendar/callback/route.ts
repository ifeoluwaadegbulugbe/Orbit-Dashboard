import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, storeGoogleCalendarTokens } from "@/lib/google-calendar/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function redirectTo(status: "connected" | "error", reason?: string) {
  const url = new URL("/booking-link", APP_URL);
  url.searchParams.set("google_calendar", status);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

/** GET /api/google-calendar/callback - Google redirects here after consent. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return redirectTo("error", error);
  if (!code || !state) return redirectTo("error", "missing_code");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("gcal_oauth_state")?.value;
  if (!stateCookie || stateCookie !== state) {
    return redirectTo("error", "invalid_state");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectTo("error", "not_signed_in");

  try {
    const tokens = await exchangeCodeForTokens(code);
    await storeGoogleCalendarTokens(createServiceClient(), user.id, tokens);
  } catch (err) {
    console.error("[google-calendar/callback] token exchange failed:", err);
    return redirectTo("error", "token_exchange_failed");
  }

  const res = redirectTo("connected");
  res.cookies.delete("gcal_oauth_state");
  return res;
}
