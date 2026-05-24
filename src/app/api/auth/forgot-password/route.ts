import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/server";
import { buildPasswordResetEmail } from "@/lib/email/booking-templates";

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 *
 * Bypasses Supabase's built-in emailer (unreliable on the free tier) by:
 *   1. Using the service-role client to generate a recovery link server-side.
 *   2. Sending the link via Resend, which already handles all other app emails.
 *
 * Always returns { ok: true } even when the email isn't registered — this
 * prevents email-enumeration attacks (an attacker can't tell whether the
 * address exists by watching the response).
 */
export async function POST(request: Request) {
  let email: string;
  try {
    const body = (await request.json()) as { email?: string };
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Build the URL the reset link should redirect back to after Supabase
  // exchanges the token. NEXT_PUBLIC_APP_URL must be set in production;
  // in local dev the Origin header is used as a fallback.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    "http://localhost:3000";

  const redirectTo = `${origin}/auth/callback`;

  // Generate a recovery link via the Admin API. This does NOT send any email —
  // it just returns the signed action_link URL we put in our own email.
  const { data, error: genError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (genError) {
    // "User not found" → return ok so we don't leak whether the email exists.
    const msg = genError.message.toLowerCase();
    if (msg.includes("not found") || msg.includes("no user")) {
      return NextResponse.json({ ok: true });
    }
    console.error("[forgot-password] generateLink failed:", genError.message);
    return NextResponse.json(
      { error: `Could not generate reset link: ${genError.message}` },
      { status: 500 },
    );
  }

  const resetLink = data?.properties?.action_link;
  if (!resetLink) {
    console.error("[forgot-password] generateLink returned no action_link");
    return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 });
  }

  // Send the email via Resend
  const { subject, html, text } = buildPasswordResetEmail({ resetLink });
  const result = await sendEmail({ to: email, subject, html, text });

  if (!result.ok && !result.skipped) {
    console.error("[forgot-password] sendEmail failed:", result.error);
    return NextResponse.json(
      { error: `Email delivery failed: ${result.error}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
