import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pushConfigured, sendPushToUser } from "@/lib/push/server";

/** POST /api/push/test - sends "it works" to the signed-in owner's phones. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "Phone notifications aren't set up on the server yet." }, { status: 503 });

  const { sent } = await sendPushToUser(createServiceClient(), user.id, {
    title: "Notifications are on",
    body: "New bookings, payments and appointment reminders will show up here.",
    url: "/home",
    tag: "orbit-test",
  });
  if (!sent) return NextResponse.json({ error: "Couldn't reach this phone. Turn notifications off and on again." }, { status: 404 });
  return NextResponse.json({ ok: true, sent });
}
