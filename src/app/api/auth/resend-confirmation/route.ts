import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resendConfirmation } from "@/lib/auth/confirm-email";
import { appUrl } from "@/lib/app-url";
import { clientIp, overLimit, HOUR } from "@/lib/rate-limit";

/**
 * POST /api/auth/resend-confirmation { email }
 * Sends a new confirmation link if that address has an unconfirmed account.
 * Always answers the same way, so it can't be used to find out who has an
 * account. Rate limited per address and per connection.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (await overLimit([
    [`resend-confirm:email:${email}`, { max: 3, windowMs: HOUR }],
    [`resend-confirm:ip:${clientIp(request)}`, { max: 10, windowMs: HOUR }],
  ])) {
    return NextResponse.json({ error: "Too many requests. Please wait a while and try again." }, { status: 429 });
  }
  await resendConfirmation(createServiceClient(), email, appUrl(request.headers.get("origin") || "http://localhost:3000"));
  return NextResponse.json({ ok: true });
}
