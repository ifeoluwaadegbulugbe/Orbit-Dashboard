"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/stores/toastStore";
import { whatsappUrl } from "@/lib/booking-profile";

/**
 * Fetches a signed link (client page or review request) and sends it to the
 * client: straight into a WhatsApp chat with them when we have their number,
 * else the share sheet, else the clipboard.
 */
export function ShareLinkButton({
  kind, id, phone, message, children, className,
}: {
  kind: "client" | "review";
  id: string;
  phone?: string | null;
  /** Builds the message around the link. */
  message: (url: string) => string;
  children: React.ReactNode;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    // Open the window synchronously so mobile browsers don't block it as a popup.
    const waWindow = phone ? window.open("about:blank", "_blank") : null;
    try {
      const res = await fetch(`/api/share-links?${kind === "client" ? "clientId" : "bookingId"}=${id}`);
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Couldn't create the link");
      const text = message(json.url);

      const wa = whatsappUrl(phone ?? undefined, text);
      if (wa && waWindow) { waWindow.location.href = wa; return; }
      waWindow?.close();
      if (navigator.share) {
        try { await navigator.share({ text }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
      }
      await navigator.clipboard.writeText(text);
      toast("Link copied - paste it to your client.", "success");
    } catch (err) {
      waWindow?.close();
      toast(err instanceof Error ? err.message : "Something went wrong", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={go} disabled={busy} className={className}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
