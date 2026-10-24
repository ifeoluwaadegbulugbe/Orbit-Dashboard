/**
 * Free start times for one business on one date - used by the public
 * availability API (to show slots) and the booking API (to accept only a
 * slot that's really free). Server only.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { freeSlots, toMinutes, validHours, type Busy } from "@/lib/booking-hours";
import { ymdInZone } from "@/lib/time/ymd";
import type { BookingConfig } from "@/lib/booking-profile";

export async function slotsForBusiness(
  supabase: SupabaseClient,
  owner: { id: string; booking_link: BookingConfig | null; timezone?: string | null },
  date: string,
  durationMin: number,
): Promise<string[] | null> {
  const hours = owner.booking_link?.hours;
  if (!validHours(hours)) return null; // no opening hours set: clients type a time

  const { data } = await supabase
    .from("bookings").select("time, duration_minutes")
    .eq("user_id", owner.id).eq("date", date).in("status", ["pending", "confirmed"]);
  const busy: Busy[] = (data ?? [])
    .filter((b) => typeof b.time === "string" && /^\d{2}:\d{2}/.test(b.time))
    .map((b) => {
      const start = toMinutes(String(b.time).slice(0, 5));
      return { start, end: start + (Number(b.duration_minutes) || 60) };
    });

  const tz = owner.timezone || "Africa/Lagos";
  const now = new Date();
  let nowMin: number | undefined;
  if (date === ymdInZone(now, tz)) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    nowMin = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
  }
  return freeSlots(hours, date, durationMin, busy, nowMin);
}
