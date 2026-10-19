import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/server";
import { EVENTS, isEventName } from "@/lib/analytics/catalog";

/**
 * POST /api/analytics/track  { event, dedupeKey?, props? }
 *
 * Browser-side events from the signed-in owner. The user id always comes
 * from the session, never the body, and only events marked `fromBrowser`
 * are accepted - payment and other trusted events are server-only.
 * Always answers 204 quickly; the browser never waits on or retries this.
 */
const MAX_PROPS = 12;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  let body: { event?: unknown; dedupeKey?: unknown; props?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!isEventName(body.event) || !EVENTS[body.event].fromBrowser) {
    return new NextResponse(null, { status: 400 });
  }

  // Keep only short scalar props - nothing free-form reaches the log.
  const props: Record<string, string | number | boolean | null> = {};
  if (body.props && typeof body.props === "object") {
    for (const [k, v] of Object.entries(body.props as Record<string, unknown>).slice(0, MAX_PROPS)) {
      if (!/^[a-z_]{1,40}$/.test(k)) continue;
      if (typeof v === "number" || typeof v === "boolean" || v === null) props[k] = v;
      else if (typeof v === "string") props[k] = v.slice(0, 64);
    }
  }
  // Scope dedupe keys to this user so one account can't block another's events.
  const dedupeKey = typeof body.dedupeKey === "string" && body.dedupeKey
    ? `${body.dedupeKey.slice(0, 120)}:${user.id}`
    : undefined;

  await track(user.id, body.event, { actor: "owner", dedupeKey, props });
  return new NextResponse(null, { status: 204 });
}
