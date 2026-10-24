"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/stores/toastStore";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push/browser";

const MESSAGE: Partial<Record<PushState, string>> = {
  unsupported: "This browser can't show phone notifications. Try Chrome on Android, or Safari on iPhone.",
  "needs-install": "On iPhone, add Orbit to your Home Screen first (Share, then Add to Home Screen), then open it from there and come back here.",
  "not-configured": "Phone notifications aren't available yet.",
  denied: "Notifications are blocked for Orbit. Allow them in your phone's settings for this site or app, then come back here.",
};

/** Settings card: switch phone (push) notifications on or off for this device. */
export function PhoneNotifications() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { pushState().then(setState).catch(() => setState("unsupported")); }, []);

  async function run(fn: () => Promise<PushState>, ok?: string) {
    setBusy(true);
    try {
      const next = await fn();
      setState(next);
      if (next === "on" && ok) toast(ok, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong. Try again.", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    toast(res?.ok ? "Sent - check your notifications." : (json?.error ?? "Couldn't send a test."), res?.ok ? "success" : "danger");
    setBusy(false);
  }

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 sm:px-7 py-5 border-b border-[var(--color-border)]">
        <BellRing className="h-4 w-4 text-[var(--color-primary)]" />
        <h3 className="text-card-title font-semibold text-[var(--color-ink)]">Phone notifications</h3>
      </div>
      <div className="px-5 sm:px-7 py-5">
        <p className="text-small text-[var(--color-ink-light)]">
          Get new bookings, payments and appointment reminders as notifications on this device, even when Orbit is closed.
        </p>
        {state === null ? (
          <div className="mt-4 h-11 rounded-[var(--radius-lg)] skeleton" />
        ) : MESSAGE[state] ? (
          <p className="mt-4 text-small text-[var(--color-ink-mid)] bg-[var(--color-canvas)] rounded-[var(--radius-lg)] px-4 py-3">{MESSAGE[state]}</p>
        ) : state === "on" ? (
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="secondary" onClick={test} loading={busy}>Send a test</Button>
            <Button variant="ghost" onClick={() => run(disablePush)} disabled={busy}>Turn off on this device</Button>
          </div>
        ) : (
          <div className="mt-4">
            <Button onClick={() => run(enablePush, "Notifications are on for this device.")} loading={busy} leftIcon={<BellRing className="h-4 w-4" />}>
              Turn on notifications
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
