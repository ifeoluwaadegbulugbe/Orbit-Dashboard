"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { AiConversation } from "@/types";

const KEY = "ai-conversations";

/** Same graceful-degrade pattern as useNotifications. */
function isMissingTableError(err: { code?: string; message?: string }): boolean {
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

/**
 * List the signed-in user's AI conversations, newest first. Returns [] if the
 * table hasn't been created yet so the sidebar doesn't crash before migration.
 */
export function useAiConversations() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<AiConversation[]>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) {
        if (isMissingTableError(error)) return [];
        throw new Error(error.message);
      }
      return (data ?? []) as AiConversation[];
    },
  });
}

/** Load one conversation's full message history (used when user clicks an old chat). */
export function useAiConversation(id: string | null) {
  return useQuery<AiConversation | null>({
    queryKey: [KEY, "single", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        if (isMissingTableError(error)) return null;
        throw new Error(error.message);
      }
      return (data ?? null) as AiConversation | null;
    },
  });
}

/** Delete a conversation by id. */
export function useDeleteAiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Could not delete chat");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** Rename a conversation. */
export function useRenameAiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("ai_conversations")
        .update({ title })
        .eq("id", id);
      if (error && !isMissingTableError(error)) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
