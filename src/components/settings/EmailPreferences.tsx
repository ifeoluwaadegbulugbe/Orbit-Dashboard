"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "@/stores/toastStore";

interface Prefs { tips: boolean; product_updates: boolean; promotions: boolean; unsubscribed: boolean }

const OPTIONS: { key: keyof Omit<Prefs, "unsubscribed">; label: string; hint: string }[] = [
  { key: "tips", label: "Tips & setup help", hint: "Short guides that help you get more out of Orbit" },
  { key: "product_updates", label: "Product updates", hint: "New features worth knowing about" },
  { key: "promotions", label: "Offers", hint: "Pro plan offers and upgrade reminders" },
];

/**
 * Lifecycle / marketing email choices. Account, security and payment emails
 * aren't listed because they can't be turned off.
 */
export function EmailPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    fetch("/api/email/preferences")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPrefs)
      .catch(() => setUnavailable(true));
  }, []);

  async function toggle(key: keyof Omit<Prefs, "unsubscribed">) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const res = await fetch("/api/email/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tips: next.tips, product_updates: next.product_updates, promotions: next.promotions }),
    });
    if (res.ok) setPrefs(await res.json());
    else { setPrefs(prefs); toast("Couldn't save your email settings.", "danger"); }
  }

  return (
    <div id="email-preferences" className="scroll-mt-20 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 sm:px-7 py-5 border-b border-[var(--color-border)]">
        <Mail className="h-4 w-4 text-[var(--color-primary)]" />
        <h3 className="text-card-title font-semibold text-[var(--color-ink)]">Email preferences</h3>
      </div>
      {unavailable ? (
        <p className="px-5 sm:px-7 py-5 text-small text-[var(--color-muted)]">Email preferences aren&apos;t available right now.</p>
      ) : !prefs ? (
        <div className="m-5 h-24 rounded-[var(--radius-lg)] skeleton" />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {OPTIONS.map((o) => (
            <label key={o.key} className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 cursor-pointer">
              <span className="min-w-0">
                <span className="block text-body text-[var(--color-ink)]">{o.label}</span>
                <span className="block text-tiny text-[var(--color-muted)] mt-0.5">{o.hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[o.key]}
                onClick={() => toggle(o.key)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${prefs[o.key] ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs[o.key] ? "translate-x-5" : ""}`} />
              </button>
            </label>
          ))}
          <p className="px-5 sm:px-7 py-4 text-tiny text-[var(--color-muted)] leading-relaxed">
            {prefs.unsubscribed
              ? "You're unsubscribed from all of these. "
              : ""}
            Emails about your account, security, bookings and payments are always sent.
          </p>
        </div>
      )}
    </div>
  );
}
