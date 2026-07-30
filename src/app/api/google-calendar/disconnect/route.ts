import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { disconnectGoogleCalendar } from "@/lib/google-calendar/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await disconnectGoogleCalendar(createServiceClient(), user.id);
  return NextResponse.json({ ok: true });
}
