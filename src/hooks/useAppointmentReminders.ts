"use client";

import { useEffect, useRef } from "react";
import { useBookings } from "@/hooks/useBookings";

/** Lead times (in minutes) before an appointment that we fire a notification. */
const LEAD_TIMES_MINUTES = [30, 15, 5];

/** Hard cap. Don't schedule more than 24h ahead, we'll re-evaluate. */
const SCHEDULE_HORIZON_MS = 24 * 60 * 60 * 1000;

const PERMISSION_REQUESTED_KEY = "orbit_notif_permission_v1";
const FIRED_KEY_PREFIX = "orbit_notif_fired_";

/**
 * Schedules browser notifications 30, 15, and 5 minutes before each upcoming
 * booking, while the app is open. Mirrors the way Google Calendar fires
 * pop-up reminders before each event.
 *
 * Limitations of pure-browser notifications:
 *  - User must have Orbit open in at least one tab for these to fire.
 *  - The user must grant Notification permission once (we ask politely).
 *  - For "even when app is closed" delivery, use the email-reminder cron route
 *    instead (server-side).
 */
export function useAppointmentReminders() {
  const { data: bookings = [] } = useBookings();
  const timers = useRef<number[]>([]);

  // 1. Politely request permission on first visit, but only once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PERMISSION_REQUESTED_KEY) === "true") return;

    // Wait a moment so we don't ambush the user during initial load.
    const t = window.setTimeout(() => {
      localStorage.setItem(PERMISSION_REQUESTED_KEY, "true");
      Notification.requestPermission().catch(() => {
        /* ignore */
      });
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // 2. Schedule timeouts for every (booking, lead-time) pair in the next 24h.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    // Clear any timers from a previous render.
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];

    const now = Date.now();
    const horizon = now + SCHEDULE_HORIZON_MS;

    bookings.forEach((b) => {
      if (b.status === "cancelled" || b.status === "completed") return;

      const eventMs = parseBookingStart(b.date, b.time);
      if (!eventMs || eventMs <= now) return;

      LEAD_TIMES_MINUTES.forEach((minutesBefore) => {
        const fireAt = eventMs - minutesBefore * 60 * 1000;
        if (fireAt <= now || fireAt > horizon) return;

        const firedKey = `${FIRED_KEY_PREFIX}${b.id}_${minutesBefore}`;
        if (localStorage.getItem(firedKey) === "true") return;

        const delay = fireAt - now;
        const id = window.setTimeout(() => {
          try {
            new Notification(`Coming up: ${b.title}`, {
              body: `With ${b.client_name} in ${minutesBefore} minutes`,
              icon: "/icon.svg",
              tag: `orbit-booking-${b.id}-${minutesBefore}`,
              requireInteraction: minutesBefore <= 5,
            });
            localStorage.setItem(firedKey, "true");
          } catch {
            // browser refused (e.g. permission revoked mid-session)
          }
        }, delay);
        timers.current.push(id);
      });
    });

    return () => {
      timers.current.forEach((id) => clearTimeout(id));
      timers.current = [];
    };
  }, [bookings]);
}

/** Parse "YYYY-MM-DD" + "HH:MM" into a local-time ms timestamp. */
function parseBookingStart(date: string, time: string): number | null {
  if (!date || !time) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  return new Date(year, month - 1, day, hour, minute).getTime();
}
