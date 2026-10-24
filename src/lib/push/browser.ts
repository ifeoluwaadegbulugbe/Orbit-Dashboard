"use client";

/**
 * Turning phone notifications on and off for this device.
 * Needs the service worker (public/sw.js), which Orbit registers in production.
 */

import { isInstalled, phonePlatform } from "@/lib/pwa-install";

export type PushState =
  | "unsupported"        // this browser can't do push at all
  | "needs-install"      // iPhone: only works once Orbit is on the home screen
  | "not-configured"     // server keys missing
  | "denied"             // they blocked notifications in the browser
  | "off" | "on";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64UrlToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  // Providers registers it in production; in development push isn't wired up.
  if (process.env.NODE_ENV !== "production") return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return phonePlatform() === "ios" && !isInstalled() ? "needs-install" : "unsupported";
  if (!KEY) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub ? "on" : "off";
}

/** Asks permission (must be called from a tap) and saves this device. */
export async function enablePush(): Promise<PushState> {
  if (!KEY) return "not-configured";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(KEY) }));
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }));
    throw new Error(error ?? "Couldn't turn on notifications. Try again.");
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => false);
  }
  return "off";
}

/**
 * On sign-out: drop this device's subscription in the browser. The session
 * is already gone, so the server can't be told - but its next send gets a
 * 410 from the push service and deletes the row itself.
 */
export function forgetPushOnThisDevice(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistration("/")
    .then((reg) => reg?.pushManager.getSubscription())
    .then((sub) => sub?.unsubscribe())
    .catch(() => {});
}
