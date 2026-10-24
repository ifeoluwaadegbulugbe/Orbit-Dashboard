import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST   /api/push/subscribe  { endpoint, keys: { p256dh, auth } }  - this phone wants notifications
 * DELETE /api/push/subscribe  { endpoint }                          - this phone doesn't any more
 *
 * The account always comes from the session. An endpoint belongs to one
 * device, so if another account signs in on the same phone and turns
 * notifications on, the row moves to that account.
 */

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const isPushEndpoint = (s: unknown): s is string => {
  if (typeof s !== "string" || s.length > 1000) return false;
  try { return new URL(s).protocol === "https:"; } catch { return false; }
};

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const p256dh = body?.keys?.p256dh, auth = body?.keys?.auth;
  if (!isPushEndpoint(body?.endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await createServiceClient().from("push_subscriptions").upsert(
    { user_id: userId, endpoint: body!.endpoint as string, p256dh, auth, user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null },
    { onConflict: "endpoint" },
  );
  if (error) {
    const missing = error.code === "42P01" || /does not exist|could not find the table/i.test(error.message);
    return NextResponse.json(
      { error: missing ? "Phone notifications aren't set up on the server yet." : "Couldn't turn on notifications. Try again." },
      { status: missing ? 503 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!isPushEndpoint(body?.endpoint)) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  await createServiceClient().from("push_subscriptions").delete().eq("endpoint", body!.endpoint as string).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
