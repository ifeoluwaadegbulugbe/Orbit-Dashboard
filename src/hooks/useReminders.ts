"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Reminder } from "@/types";

const KEY = "reminders";

// ─── Queries ────────────────────────────────────────────────────────────────

export function useReminders() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<Reminder[]>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId!)
        .order("due_date", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Reminder[];
    },
  });
}

export function useRemindersForClient(clientId: string | undefined) {
  return useQuery<Reminder[]>({
    queryKey: [KEY, "client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("client_id", clientId!)
        .order("due_date", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Reminder[];
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateReminder() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (
      payload: Omit<Reminder, "id" | "user_id" | "created_at" | "is_done">,
    ) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("reminders")
        .insert({ ...payload, user_id: userId!, is_done: false })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Reminder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useToggleReminder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("reminders")
        .update({ is_done: isDone })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
