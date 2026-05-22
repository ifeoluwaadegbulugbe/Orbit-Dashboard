"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Client } from "@/types";

const KEY = "clients";

// ─── Queries ────────────────────────────────────────────────────────────────

export function useClients() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<Client[]>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
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
      if (error) throw new Error(error.message);
      return data as Client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
