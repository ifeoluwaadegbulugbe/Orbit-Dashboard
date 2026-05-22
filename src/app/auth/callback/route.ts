import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 *
 * Supabase email-link target. Three flow shapes hit this route:
 *
 * 1. Signup verification     ?code=...&type=signup    -> exchange + go to /welcome
 * 2. Password reset          ?code=...&type=recovery  -> exchange + go to /reset-password
 * 3. Magic link              ?code=...&type=magiclink -> exchange + go to /home
 *
 * The Supabase Auth helpers exchange the `code` query param for a real
 * session cookie, which the rest of the app then reads via createClient().
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type") ?? "signup";
  const next = requestUrl.searchParams.get("next");

  if (!code) {
    // Either Supabase didn't send a code, or the link is malformed/expired.
    // Bounce to login with a friendly message.
    return NextResponse.redirect(
      new URL("/login?verifyError=missing_code", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Most common: link already used (user clicked twice) or expired (24h).
    const reason = error.message.includes("expired")
      ? "link_expired"
      : "exchange_failed";
    return NextResponse.redirect(
      new URL(`/login?verifyError=${reason}`, requestUrl.origin),
    );
  }

  // Decide the next destination based on what triggered the email
  let target = next ?? "/welcome";
  if (type === "recovery") target = "/reset-password";
  else if (type === "magiclink") target = "/home";

  return NextResponse.redirect(new URL(target, requestUrl.origin));
}
