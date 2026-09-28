import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";
import { buildPasswordResetEmail } from "@/lib/email/booking-templates";

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 *
 * Standard reset-link flow (OWASP Forgot Password cheat sheet):
 *   1. Service-role client calls admin.generateLink({ type: "recovery" }) —
 *      this creates a single-use, time-limited token but sends nothing.
 *   2. We email a link to OUR domain carrying only the token *hash*:
 *        /reset-password?token_hash=…&type=recovery
 *      No session tokens ever appear in the URL, and the token is only
 *      redeemed (verifyOtp) when the user submits a new password, so email
 *      link scanners that pre-open links can't burn it.
 *   3. Rate limited per email and per IP.
 *
 * Returns { ok: true } whether or not the email is registered, so the
 * response can't be used to discover which addresses have accounts.
 */

const PER_EMAIL_WINDOW_MS = 60 * 1000;      // 1 request / minute / email
const PER_EMAIL_HOURLY    = 5;              // 5 requests / hour / email
const PER_IP_HOURLY       = 20;             // 20 requests / hour / IP

export async function POST(request: Request) {
  let email: string;
  try {
    const body = (await request.json()) as { email?: string };
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;

  // ── Rate limit ──────────────────────────────────────────────────────────
  const limited = await isRateLimited(supabase, email, ip);
  if (limited) {
    return NextResponse.json(
      { error: "Too many reset requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  // NEXT_PUBLIC_APP_URL must be set in production; in local dev the Origin
  // header is used as a fallback. Trailing slashes are stripped so we never
  // build "https://app//reset-password".
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  const { data, error: genError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (genError) {
    // Unknown email → pretend it worked so we don't leak which emails exist.
    const msg = genError.message.toLowerCase();
    if (msg.includes("not found") || msg.includes("no user") || genError.status === 404) {
      return NextResponse.json({ ok: true });
    }
    console.error("[forgot-password] generateLink failed:", genError.message);
    return NextResponse.json(
      { error: "Could not create a reset link right now. Please try again shortly." },
      { status: 500 },
    );
  }

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) {
    console.error("[forgot-password] generateLink returned no hashed_token");
    return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 });
  }

  const resetLink =
    `${origin}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;

  const { subject, html, text } = buildPasswordResetEmail({ resetLink });
  const result = await sendEmail({ to: email, subject, html, text });

  if (!result.ok) {
    // Includes the "no provider configured" case — previously that returned
    // ok:true and the user waited for an email that was never sent.
    console.error("[forgot-password] sendEmail failed:", result.error);
    return NextResponse.json(
      { error: "We couldn't send the reset email right now. Please try again shortly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * Records this request and reports whether the caller is over the limit.
 * Fails open (allows the request) if the table is missing, so a skipped
 * migration degrades to "no rate limit" rather than "no password resets".
 */
async function isRateLimited(
  supabase: ReturnType<typeof createServiceClient>,
  email: string,
  ip: string | null,
): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: recent, error } = await supabase
    .from("password_reset_requests")
    .select("created_at")
    .eq("email", email)
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[forgot-password] rate-limit check skipped:", error.message);
    return false;
  }

  const last = recent?.[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
  if (Date.now() - last < PER_EMAIL_WINDOW_MS) return true;
  if ((recent?.length ?? 0) >= PER_EMAIL_HOURLY) return true;

  if (ip) {
    const { count } = await supabase
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= PER_IP_HOURLY) return true;
  }

  await supabase.from("password_reset_requests").insert({ email, ip });
  return false;
}
