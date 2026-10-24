"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Client } from "@/types";
import { track } from "@/lib/analytics/browser";
import { allRows } from "@/lib/supabase/all-rows";

const KEY = "clients";

// ─── Queries ────────────────────────────────────────────────────────────────

export function useClients() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<Client[]>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await allRows(() => supabase
        .from("clients")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .order("id"));
      if (error) throw new Error(error.message);
      return (data ?? []) as Client[];
    },
  });
}

export function useClient(id: string | undefined) {
  return useQuery<Client | null>({
    queryKey: [KEY, "one", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) return null;
      return data as Client;
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

type ClientInsert = Omit<Client, "id" | "created_at" | "updated_at" | "total_paid" | "outstanding_balance">;
type ClientUpdate = Partial<Omit<Client, "id" | "user_id" | "created_at" | "updated_at">>;

export function useCreateClient() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (payload: Omit<ClientInsert, "user_id">) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...payload, user_id: userId!, total_paid: 0, outstanding_balance: 0 })
        .select()
        .single();
      if (error) {
        // The database enforces the Free limit too (migration 022).
        if (error.message.includes("FREE_CLIENT_LIMIT")) {
          throw new Error("You've reached the 10-client limit on Free. Your clients are safe. Upgrade to Pro for unlimited clients and a lower Orbit Pay fee.");
        }
        throw new Error(error.message);
      }
      return data as Client;
    },
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      track("client_created", { dedupeKey: `client_created:${client.id}` });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ClientUpdate }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("clients")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Client;
    },
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      // One per client per minute - a burst of saves is one edit.
      track("client_updated", { dedupeKey: `client_updated:${client.id}:${new Date().toISOString().slice(0, 16)}` });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      track("client_deleted", { dedupeKey: `client_deleted:${id}` });
    },
  });
}
