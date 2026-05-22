"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ProjectStatus = "not_started" | "in_progress" | "delivered";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  delivered: "Delivered",
};

const LOCAL_PREFIX = "orbit_project_status_";

/**
 * Per-client project status. Persists to clients.project_status if the column
 * exists; otherwise falls back to localStorage. Optimistic update so the UI
 * flips instantly when the user taps.
 */
export function useProjectStatus(clientId: string, initial: ProjectStatus = "not_started") {
  const [status, setStatus] = useState<ProjectStatus>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage so we have an instant initial value even before
  // the next Supabase round trip resolves.
  useEffect(() => {
    if (!clientId) return;
    try {
      const local = localStorage.getItem(LOCAL_PREFIX + clientId);
      if (local && isProjectStatus(local)) setStatus(local);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [clientId]);

  async function update(next: ProjectStatus) {
    setStatus(next); // optimistic
    try {
      localStorage.setItem(LOCAL_PREFIX + clientId, next);
    } catch {
      /* ignore */
    }
    // Best-effort sync to Supabase. If the column doesn't exist yet, we
    // silently fall back to localStorage-only persistence.
    try {
      const supabase = createClient();
      await supabase.from("clients").update({ project_status: next }).eq("id", clientId);
    } catch {
      /* ignore */
    }
  }

  return { status, setStatus: update, hydrated };
}

function isProjectStatus(v: string): v is ProjectStatus {
  return v === "not_started" || v === "in_progress" || v === "delivered";
}
