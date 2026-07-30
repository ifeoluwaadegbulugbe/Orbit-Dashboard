"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Calendar, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "@/stores/toastStore";

interface Status {
  connected: boolean;
  configured: boolean;
}

/**
 * One-way sync only: confirmed bookings get pushed to the owner's Google
 * Calendar. Orbit never reads the connected calendar back.
 */
export function GoogleCalendarCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/google-calendar/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setStatus(data))
      .catch(() => setStatus({ connected: false, configured: false }));
  }, []);

  // Show a toast for the redirect back from Google, then strip the query
  // params so refreshing the page doesn't re-fire it.
  useEffect(() => {
    const result = search.get("google_calendar");
    if (!result) return;

    if (result === "connected") {
      toast("Google Calendar connected", "success");
      setStatus((s) => (s ? { ...s, connected: true } : s));
    } else if (result === "error") {
      const reason = search.get("reason");
      toast(
        reason === "not_configured"
          ? "Google Calendar isn't set up on this server yet."
          : "Could not connect Google Calendar. Try again.",
        "danger",
      );
    }
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDisconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      setStatus((s) => (s ? { ...s, connected: false } : s));
      toast("Google Calendar disconnected", "default");
    } catch {
      toast("Could not disconnect. Try again.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7">
      <div className="flex items-center gap-3 mb-3">
        <Calendar className="h-5 w-5 text-[var(--color-primary)]" />
        <h3 className="text-card-title font-semibold">Google Calendar</h3>
      </div>
      <p className="text-small text-[var(--color-ink-light)] leading-relaxed mb-4">
        Confirmed bookings are pushed to your Google Calendar automatically. One-way only -
        Orbit never reads your calendar back.
      </p>

      {status === null ? (
        <div className="h-11 rounded-full skeleton" />
      ) : !status.configured ? (
        <div className="flex items-start gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-warning-light)] text-[var(--color-warning-deep)]">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="text-small leading-relaxed">Google Calendar sync isn&apos;t set up on this server yet.</p>
        </div>
      ) : status.connected ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-success-light)]">
          <span className="inline-flex items-center gap-2 text-small font-semibold text-[var(--color-success-deep)]">
            <CheckCircle2 className="h-4 w-4" /> Connected
          </span>
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="text-tiny font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Disconnect"}
          </button>
        </div>
      ) : (
        <a
          href="/api/google-calendar/connect"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-primary)] text-white text-small font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <Calendar className="h-4 w-4" /> Connect Google Calendar
        </a>
      )}
    </div>
  );
}
