import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runLifecycle } from "@/lib/lifecycle/engine";

/**
 * GET /api/cron/lifecycle - runs the lifecycle email engine.
 * Triggered every 15 minutes by Supabase pg_cron (migration 018) with
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Unlike the older cron routes, this one refuses to run in production
 * without CRON_SECRET: it emails real users, so it must never be callable
 * by anyone who finds the URL.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runLifecycle(createServiceClient());
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("[lifecycle] run failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
