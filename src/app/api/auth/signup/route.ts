import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = body.fullName?.trim() ?? "";
  const businessName = body.businessName?.trim() || null;
  const businessType = body.businessType ?? "other";

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

  // ── 1. Create the user (auto-confirmed, no verification email) ─────────
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,                 // <- key: skip Supabase SMTP
    user_metadata: {
      full_name: fullName,
      business_name: businessName,
      business_type: businessType,
    },
  });

  if (createErr || !created.user) {
    const msg = (createErr?.message ?? "Could not create account").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 },
      );
    }
    if (msg.includes("password")) {
      return NextResponse.json(
        { error: "Pick a stronger password - at least 8 characters." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: createErr?.message ?? "Could not create account" },
      { status: 500 },
    );
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
  });
  if (profileErr) {
    // Not fatal - /welcome's mount effect upserts the profile too as a
    // belt-and-braces. Log so we can investigate in production logs.
    console.warn("[signup] profile upsert failed:", profileErr.message);
  }

  return NextResponse.json({
    ok: true,
    userId,
    email,
  });
}
