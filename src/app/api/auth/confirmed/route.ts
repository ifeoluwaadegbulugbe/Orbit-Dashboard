import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/confirmed - called by /auth/confirm right after the
 * email link was verified. Records the confirmation on the profile (only
 * if Supabase itself says the email is confirmed), which switches on the
 * welcome and setup emails for this account.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.email_confirmed_at) return NextResponse.json({ error: "Email not confirmed" }, { status: 409 });
  await createServiceClient().from("profiles").update({ email_confirmed: true }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
