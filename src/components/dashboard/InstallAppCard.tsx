"use client";

import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/browser";
import {
  canPromptInstall, isInstalled, onInstallChange, phonePlatform, promptInstall, type Platform,
} from "@/lib/pwa-install";

const DISMISS_KEY = "orbit-install-card-dismissed";

/**
 * "Put Orbit on your home screen" - phones only, hidden once installed or
 * dismissed. Android (Chrome) gets a one-tap Install button; iPhone gets the
 * Share → Add to Home Screen steps, since Apple allows nothing else.
 */
export function InstallAppCard() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* storage blocked */ }
    const p = phonePlatform();
    setPlatform(p);
    setHidden(dismissed || isInstalled() || p === "other");
    setCanPrompt(canPromptInstall());
    return onInstallChange(() => {
      setCanPrompt(canPromptInstall());
      if (isInstalled()) setHidden(true);
    });
  }, []);

  if (hidden || !platform) return null;

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  async function install() {
    const accepted = await promptInstall();
    if (accepted) {
      track("app_installed", { props: { platform: "android" } });
      dismiss();
    }
  }

  return (
    <section className="relative bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Don't show this again"
        className="absolute top-3 right-3 p-2 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4 pr-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="text-body font-semibold text-[var(--color-ink)]">Put Orbit on your home screen</h2>
          <p className="text-small text-[var(--color-ink-light)] mt-1">
            Opens full screen like an app, with your clients and bookings one tap away - even with bad network.
          </p>
        </div>
      </div>

      {platform === "android" && canPrompt ? (
        <div className="mt-4">
          <Button fullWidth onClick={install} leftIcon={<Download className="h-4 w-4" />}>Install Orbit</Button>
        </div>
      ) : (
        <ol className="mt-4 space-y-2.5 text-small text-[var(--color-ink-mid)]">
          {platform === "ios" ? (
            <>
              <Step n={1}>Open this page in <strong>Safari</strong></Step>
              <Step n={2}>Tap <Share className="inline h-4 w-4 -mt-0.5 text-[var(--color-info)]" aria-label="Share" /> <strong>Share</strong> at the bottom of the screen</Step>
              <Step n={3}>Tap <PlusSquare className="inline h-4 w-4 -mt-0.5" aria-hidden /> <strong>Add to Home Screen</strong>, then <strong>Add</strong></Step>
            </>
          ) : (
            <>
              <Step n={1}>Tap the <MoreVertical className="inline h-4 w-4 -mt-0.5" aria-label="menu" /> menu at the top right of your browser</Step>
              <Step n={2}>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></Step>
            </>
          )}
        </ol>
      )}
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] text-tiny font-bold flex items-center justify-center">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
