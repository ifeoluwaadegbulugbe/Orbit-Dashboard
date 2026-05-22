import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/server";

/**
 * One-click smoke test for the notification pipeline.
 *
 * POST /api/notifications/test
 *
 * Inserts a sample notification for the signed-in user. If the
 * notifications table is missing or RLS is misconfigured, the response tells
 * you exactly what went wrong instead of failing silently.
 *
 * Used by the bell dropdown's "Send test notification" button.
 */
export async function POST() {
  const userClient = await createClient();
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  const userId = authData.user.id;

  const supabase = createServiceClient();

  // Direct insert (bypassing notify() so we can return the actual DB error)
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: "welcome",
    title: "Test notification received",
    body: "If you can see this in the bell, your notification setup is working. New bookings, payments and reminders will land here automatically.",
    action_url: "/home",
    is_read: false,
    metadata: { source: "self_test" },
  });

  if (error) {
    // Most common failure: the migration hasn't been run yet.
    const msg = error.message?.toLowerCase() ?? "";
    if (
      error.code === "42P01" ||
      msg.includes("does not exist") ||
      msg.includes("could not find the table")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The notifications table doesn't exist yet. Run the SQL from supabase/migrations/002_notifications.sql in your Supabase SQL Editor first.",
          code: "TABLE_MISSING",
        },
        { status: 412 },
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: 500 },
    );
  }

  // Also fire one via the standard notify() helper to confirm it works for
  // future webhook firings too.
  await notify(supabase, {
    userId,
    type: "booking_received",
    title: "Sample booking arrived",
    body: "This is a second test - it proves webhooks will also write to the bell.",
    actionUrl: "/work?tab=calendar",
    metadata: { source: "self_test_via_notify" },
  });

  return NextResponse.json({
    ok: true,
    message: "Two test notifications inserted. Check the bell.",
  });
}
