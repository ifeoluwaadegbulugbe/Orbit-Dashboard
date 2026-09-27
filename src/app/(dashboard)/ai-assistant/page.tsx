"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAiPanelStore } from "@/stores/aiPanelStore";

/**
 * AI Assistant is no longer a standalone destination - it's a floating panel
 * summonable from any page (see AiLauncherButton + AssistantPanel, mounted in
 * the dashboard layout). This route stays only for old bookmarks/links: it
 * opens the panel and sends you to Home underneath it.
 */
export default function AiAssistantRedirect() {
  const router = useRouter();
  const openPanel = useAiPanelStore((s) => s.openPanel);

  useEffect(() => {
    openPanel();
    router.replace("/home");
  }, [openPanel, router]);

  return null;
}
