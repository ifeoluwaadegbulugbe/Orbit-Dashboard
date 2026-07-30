import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isGoogleCalendarConnected, isGoogleCalendarConfigured } from "@/lib/google-calendar/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connected = await isGoogleCalendarConnected(createServiceClient(), user.id);
  return NextResponse.json({ connected, configured: isGoogleCalendarConfigured() });
}
