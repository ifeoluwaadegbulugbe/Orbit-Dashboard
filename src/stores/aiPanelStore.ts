"use client";

import { create } from "zustand";

interface AiPanelState {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

/**
 * Controls the floating AI Assistant panel, mounted once in the dashboard
 * layout so it's summonable from every tab instead of living behind its own
 * nav item - see the discussion around embedding AI everywhere rather than
 * making it a destination.
 */
export const useAiPanelStore = create<AiPanelState>((set) => ({
  open: false,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
}));
