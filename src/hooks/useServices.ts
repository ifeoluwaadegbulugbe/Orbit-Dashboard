"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Service } from "@/types";

/**
 * Services live in profiles.booking_link.services (jsonb). Same source the
 * public /book/<slug> page reads, so anywhere the owner edits the list, the
 * booking page stays in sync.
 *
 * Falls back gracefully if the booking_link column doesn't exist yet -
 * useful while the DB migration is still pending.
 */

const KEY = "services";

interface BookingLinkConfig {
  slug?: string;
  intro?: string;
  services?: Service[];
  availability?: string;
}

export function useServices() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<Service[]>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("booking_link")
        .eq("id", userId!)
        .maybeSingle();
      if (error) {
        // booking_link column may not exist yet - degrade to empty list.
        if (error.code === "42703" || error.message?.toLowerCase().includes("column")) {
          return [];
        }
        throw new Error(error.message);
      }
      const config = (data?.booking_link as BookingLinkConfig | null) ?? null;
      return config?.services ?? [];
    },
  });
}

/**
 * Replace the whole services array on the profile. We merge into the existing
 * booking_link object so other fields (slug, intro, availability) stay intact.
 */
export function useUpdateServices() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (services: Service[]) => {
      if (!userId) throw new Error("Not signed in");
      const supabase = createClient();

      // Read the existing config first so we don't wipe slug/intro/etc.
      const { data: row } = await supabase
        .from("profiles")
        .select("booking_link")
        .eq("id", userId)
        .maybeSingle();
      const existing = (row?.booking_link as BookingLinkConfig | null) ?? {};

      const merged: BookingLinkConfig = { ...existing, services };

      const { error } = await supabase
        .from("profiles")
        .update({ booking_link: merged })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return services;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      // Booking-link page also reads booking_link; keep both fresh.
      qc.invalidateQueries({ queryKey: ["booking_link"] });
    },
  });
}
