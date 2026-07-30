"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Booking } from "@/types";

const KEY = "bookings";

type BookingInsert = Omit<Booking, "id" | "created_at" | "updated_at">;

/**
 * Fire-and-forget push to Google Calendar. These hooks write directly to
 * Supabase from the browser, so there's no server context to call
 * syncBookingToGoogleCalendar() in-process - this hits the thin API wrapper
 * instead. Never awaited by callers and never throws into the UI: a sync
 * failure must not surface as a booking-save error.
 */
function syncToGoogleCalendar(bookingId: string) {
  fetch("/api/google-calendar/sync-booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId }),
  }).catch(() => {
    // Best-effort - ignore. The booking itself already saved successfully.
  });
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useBookings() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<Booking[]>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId!)
        .order("date", { ascending: true })
        .order("time", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Booking[];
    },
  });
}

export function useBookingsForClient(clientId: string | undefined) {
  return useQuery<Booking[]>({
    queryKey: [KEY, "client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("client_id", clientId!)
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Booking[];
    },
  });
}

// ─── Mutation ───────────────────────────────────────────────────────────────

/** Confirm, cancel, or otherwise change the status of a booking. */
export function useUpdateBookingStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Booking["status"] }) => {
      const supabase = createClient();
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      syncToGoogleCalendar(id);
    },
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (payload: Omit<Booking, "id" | "user_id" | "created_at" | "updated_at">) => {
      const supabase = createClient();
      const full: BookingInsert = { ...payload, user_id: userId! };

      const { data, error } = await supabase
        .from("bookings")
        .insert(full)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Booking;
    },
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      syncToGoogleCalendar(booking.id);
    },
  });
}
