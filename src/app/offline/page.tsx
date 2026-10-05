import { WifiOff } from "lucide-react";

export const metadata = { title: "You're offline" };

/** Shown by the service worker when a page isn't cached and there's no connection. */
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4">
      <div className="w-full max-w-sm bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--color-canvas)] flex items-center justify-center">
          <WifiOff className="h-6 w-6 text-[var(--color-ink-light)]" />
        </div>
        <h1 className="text-card-title font-bold">You&apos;re offline</h1>
        <p className="mt-2 text-small text-[var(--color-ink-light)] leading-relaxed">
          This page hasn&apos;t been opened on this device yet. Pages you&apos;ve already visited still work -
          and everything syncs once you&apos;re back online.
        </p>
        <a href="/home" className="mt-5 inline-flex px-5 py-2.5 rounded-full bg-[var(--color-primary)] text-white text-small font-bold">
          Go to Home
        </a>
      </div>
    </div>
  );
}
