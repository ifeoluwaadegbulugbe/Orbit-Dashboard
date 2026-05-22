"use client";

import { useAppointmentReminders } from "@/hooks/useAppointmentReminders";
import { useAuthStore } from "@/stores/authStore";

/**
 * Mount once inside the dashboard layout. Drives the browser-notification
 * scheduler when there's a signed-in user. Renders nothing.
 */
export function AppointmentReminders() {
  const user = useAuthStore((s) => s.user);
  // Always call the hook (React rules), but it's a no-op until bookings load.
  useAppointmentReminders();
  void user;
  return null;
}
