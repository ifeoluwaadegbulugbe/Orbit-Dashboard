"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Payment } from "@/types";

const KEY = "payments";

export function usePayments() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<Payment[]>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", userId!)
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Payment[];
    },
  });
}

export function usePaymentsForClient(clientId: string | undefined) {
  return useQuery<Payment[]>({
    queryKey: [KEY, "client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", clientId!)
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Payment[];
    },
  });
}

export function usePayment(id: string | undefined) {
  return useQuery<Payment | null>({
    queryKey: [KEY, "one", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("payments").select("*").eq("id", id!).single();
      if (error) return null;
      return data as Payment;
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

type PaymentInsert = Omit<Payment, "id" | "created_at">;

export function useCreatePayment() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (payload: Omit<PaymentInsert, "user_id">) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .insert({ ...payload, user_id: userId! })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Payment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Payment> }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Payment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
