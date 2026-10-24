"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/stores/toastStore";
import { isInstalled } from "@/lib/pwa-install";
import { enablePush, pushState } from "@/lib/push/browser";

const DISMISS_KEY = "orbit-notify-card-dismissed";

/**
 * After Orbit is installed (opened from the home-screen icon), nudge once
 * to turn on phone notifications - the install card is gone by then, and
 * on iPhone this is the only place notifications can be switched on.
 */
export function EnableNotificationsCard() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* storage blocked */ }
    if (dismissed || !isInstalled()) return;
    pushState().then((s) => setShow(s === "off")).catch(() => {});
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  async function turnOn() {
    setBusy(true);
    try {
      const s = await enablePush();
      if (s === "on") { toast("Notifications are on for this phone.", "success"); setShow(false); }
      else if (s === "denied") { toast("Notifications are blocked. Allow them for Orbit in your phone's Settings.", "danger"); }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't turn on notifications.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5">
      <button type="button" onClick={dismiss} aria-label="Don't show this again"
        className="absolute top-3 right-3 p-2 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-canvas)]">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4 pr-8">
        <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
          <BellRing className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-body font-semibold text-[var(--color-ink)]">Get notifications like a normal app</h2>
          <p className="text-small text-[var(--color-ink-light)] mt-1">New bookings, payments and appointment reminders on your lock screen, even when Orbit is closed.</p>
        </div>
      </div>
      <div className="mt-4">
        <Button fullWidth onClick={turnOn} loading={busy} leftIcon={<BellRing className="h-4 w-4" />}>Turn on notifications</Button>
      </div>
    </section>
  );
}
