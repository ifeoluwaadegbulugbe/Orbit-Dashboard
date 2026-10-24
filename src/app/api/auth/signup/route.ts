import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/server";
import { clientIp, overLimit, HOUR } from "@/lib/rate-limit";
import { confirmUrl, resendConfirmation, sendConfirmationEmail } from "@/lib/auth/confirm-email";
import { appUrl } from "@/lib/app-url";
import { BUSINESS_TYPE_LABELS } from "@/types";

/**
 * POST /api/auth/signup
 *
 * Creates an Orbit account in one server-side hop. Uses the Supabase Admin
 * API so we don't have to depend on Supabase's email service (which is
 * heavily rate-limited and has been failing with "Error sending confirmation
 * email" for our users).
 *
 * Flow:
 *   1. admin.createUser with email_confirm=true   -> no verification email
 *   2. insert profile row with the wizard data
 *   3. Client signs in with the same credentials after we return ok
 *   4. /welcome page fires the Resend-backed welcome email separately
 *
 * Body: { email, password, fullName, businessName, businessType }
 *
 * Notes:
 *   - We never expose the service-role key to the browser - it's only used here.
 *   - If the email is already registered, we surface a clear error so the
 *     UI can suggest "sign in instead".
 */

interface RequestBody {
  email?: string;
  password?: string;
  fullName?: string;
  businessName?: string | null;
  businessType?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Slow down bulk/bot signups (each one triggers emails to that address).
  if (await overLimit([[`signup:ip:${clientIp(request)}`, { max: 5, windowMs: HOUR }]])) {
    return NextResponse.json({ error: "Too many sign-ups from this connection. Please try again in an hour." }, { status: 429 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = body.fullName?.trim() ?? "";
  const businessName = body.businessName?.trim() || null;
  // Only known types; anything else (or nothing - signup no longer asks) is "other".
  const businessType = body.businessType && body.businessType in BUSINESS_TYPE_LABELS ? body.businessType : "other";

  // ── Validation ─────────────────────────────────────────────────────────
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  }

  // Guard against missing service-role key (env misconfigured)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Server not configured. Set SUPABASE_SERVICE_ROLE_KEY in env." },
      { status: 500 },
    );
  }

  const supabase = createServiceClient();

  // ── 1. Create the user UNCONFIRMED and get a one-time confirmation token.
  // generateLink creates the account but sends nothing; we email the link
  // ourselves (Resend), so it works reliably and looks like Orbit.
  const origin = appUrl(request.headers.get("origin") || "http://localhost:3000");
  const { data: link, error: createErr } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { data: { full_name: fullName, business_name: businessName, business_type: businessType } },
  });
  const created = link ? { user: link.user } : null;

  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? "Could not create account").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      // Unconfirmed earlier attempt? Send them a fresh link instead of a dead end.
      await resendConfirmation(supabase, email, origin);
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in, or check your inbox for a confirmation link.", code: "EXISTS" },
        { status: 409 },
      );
    }
    if (msg.includes("password")) {
      return NextResponse.json(
        { error: "Pick a stronger password - at least 8 characters." },
        { status: 400 },
      );
    }
    console.error("[signup] generateLink failed:", createErr?.message);
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }

  const userId = created.user.id;

  // ── 2. Insert the profile row ──────────────────────────────────────────
  // Service-role bypasses RLS so this always works. /welcome will read this
  // and skip its own upsert.
  const { error: profileErr } = await supabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    business_name: businessName,
    business_type: businessType,
    subscription_status: "free",
    email_confirmed: false,
  });
  if (profileErr) {
    // Not fatal - /welcome's mount effect upserts the profile too as a
    // belt-and-braces. Log so we can investigate in production logs.
    console.warn("[signup] profile upsert failed:", profileErr.message);
  }

  await track(userId, "signup_completed", { dedupeKey: `signup_completed:${userId}:${userId}` });

  const sent = await sendConfirmationEmail(
    email,
    confirmUrl(origin, link!.properties.hashed_token, link!.properties.verification_type),
    fullName.split(/\s+/)[0] || null,
    origin,
  );
  if (!sent.ok) console.error("[signup] confirmation email failed:", sent.error);

  return NextResponse.json({ ok: true, needsConfirmation: true, email, emailSent: sent.ok });
}
