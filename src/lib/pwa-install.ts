"use client";

/**
 * "Install Orbit" support. Chrome on Android fires `beforeinstallprompt`
 * once, often before the Home page has mounted, so it's captured here as
 * early as possible (from Providers) and handed to whoever asks later.
 * iPhones have no such event - Safari only allows Share → Add to Home Screen.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let listening = false;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());

/** Call once, early. Safe to call again. */
export function captureInstallPrompt(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of Chrome's mini-bar
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function onInstallChange(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function canPromptInstall(): boolean {
  return !!deferred;
}

/** Shows the browser's install dialog. Resolves true if they installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // each event can only be used once
  notify();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === "accepted";
  } catch {
    return false;
  }
}

/** Already running from the home screen? */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type Platform = "ios" | "android" | "other";

export function phonePlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but has touch.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}
