"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { MessageRuleRow, TriggerType } from "@/lib/automations/rules";

const KEY = "message-rules";

export function useMessageRules() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<MessageRuleRow[]>({
    queryKey: [KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("message_rules")
        .select("trigger_type, enabled, template")
        .eq("user_id", userId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as MessageRuleRow[];
    },
  });
}

/** Upserts a single trigger's rule - used for both the enabled toggle and the template textarea. */
export function useSetMessageRule() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (patch: { triggerType: TriggerType; enabled: boolean; template: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("message_rules")
        .upsert(
          {
            user_id: userId!,
            trigger_type: patch.triggerType,
            enabled: patch.enabled,
            template: patch.template,
          },
          { onConflict: "user_id,trigger_type" },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
