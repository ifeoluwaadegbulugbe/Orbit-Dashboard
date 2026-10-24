import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { slotsForBusiness } from "@/lib/booking-availability";
import { clientIp, overLimit, HOUR } from "@/lib/rate-limit";
import type { BookingConfig } from "@/lib/booking-profile";

/**
 * GET /api/public/availability?slug=glam-by-shola&date=2026-10-26&duration=90
 * → { slots: ["09:00", "09:30", ...] }  or  { slots: null } if the business
 * hasn't set opening hours (then the page lets clients type a time).
 * Reveals only which times are free - never who booked them.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const slug = (q.get("slug") ?? "").trim();
  const date = q.get("date") ?? "";
  const duration = Math.min(12 * 60, Math.max(15, Number(q.get("duration")) || 60));
  if (!slug || slug.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (await overLimit([[`availability:ip:${clientIp(request)}`, { max: 300, windowMs: HOUR }]])) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = createServiceClient();
  const { data: owner } = await supabase
    .from("profiles").select("id, booking_link, timezone").eq("booking_link->>slug", slug).maybeSingle();
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slots = await slotsForBusiness(supabase, { id: owner.id, booking_link: owner.booking_link as BookingConfig | null, timezone: owner.timezone }, date, duration);
  return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
