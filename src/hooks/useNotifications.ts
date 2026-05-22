"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { NotificationRow } from "@/types";

const KEY = "notifications";

/** Detects "table does not exist" so we degrade gracefully on first install. */
function isMissingTableError(err: { code?: string; message?: string }): boolean {
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "42P01" ||                       // PostgreSQL undefined_table
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

/**
 * Internal shape - the hook returns both the rows and a flag for whether
 * the notifications table is missing so the bell can show a "run the
 * migration" hint instead of pretending all is well.
 */
interface NotificationsResult {
  rows: NotificationRow[];
  setupNeeded: boolean;
}

/**
 * Fetch all notifications for the current user. Polls every 30s so new ones
 * appear without a refresh. If the table doesn't exist, returns
 * setupNeeded=true so the UI can surface a clear migration prompt.
 */
export function useNotificationsResult() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<NotificationsResult>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (isMissingTableError(error)) {
          return { rows: [], setupNeeded: true };
        }
        throw new Error(error.message);
      }
      return {
        rows: (data ?? []) as NotificationRow[],
        setupNeeded: false,
      };
    },
  });
}

/**
 * Backwards-compatible shim returning just the array. Use this when you
 * don't care about the setupNeeded flag.
 */
export function useNotifications() {
  const result = useNotificationsResult();
  return {
    ...result,
    data: result.data?.rows ?? [],
  };
}

export function useUnreadCount(): number {
  const { data } = useNotificationsResult();
  return (data?.rows ?? []).filter((n) => !n.is_read).length;
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error && !isMissingTableError(error)) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error && !isMissingTableError(error)) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
