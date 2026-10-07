"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useBookings } from "@/hooks/useBookings";
import { createClient } from "@/lib/supabase/client";
import { ACTIVATION_STEPS, activation, type UserFacts } from "@/lib/lifecycle/activation";

/**
 * "Finish setting up" checklist on Home. Uses the same activation rules as
 * the lifecycle emails, so the app and the inbox always agree. Disappears
 * once every step is done (or the owner dismisses it).
 */
export function SetupChecklist() {
  const profile = useAuthStore((s) => s.profile);
  const userId = useAuthStore((s) => s.user?.id) ?? profile?.id ?? null;
  const { data: clients, isLoading: cl } = useClients();
  const { data: payments, isLoading: pl } = usePayments();
  const { data: bookings, isLoading: bl } = useBookings();
  const [link, setLink] = useState<{ slug?: string; services?: unknown[] } | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!userId) return;
    try { setDismissed(localStorage.getItem(`orbit-setup-dismissed:${userId}`) === "1"); } catch { setDismissed(false); }
    createClient().from("profiles").select("booking_link").eq("id", userId).maybeSingle()
      .then(({ data }) => setLink((data?.booking_link as typeof link) ?? null));
  }, [userId]);

  if (!userId || dismissed || link === undefined || cl || pl || bl) return null;

  const facts: UserFacts = {
    signedUpAt: "", lastActiveAt: null, isPro: false,
    hasBusinessName: !!profile?.business_name?.trim(),
    serviceCount: Array.isArray(link?.services) ? link!.services!.length : 0,
    bookingLinkLive: !!link?.slug,
    clientCount: clients?.length ?? 0,
    bookingCount: bookings?.length ?? 0,
    invoiceCount: payments?.length ?? 0,
    paidInvoiceCount: payments?.filter((p) => p.status === "paid").length ?? 0,
    reminderCount: 0,
  };
  const act = activation(facts);
  if (act.activated) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(`orbit-setup-dismissed:${userId}`, "1"); } catch { /* ignore */ }
  }

  return (
    <section className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-card-title font-semibold text-[var(--color-ink)]">Finish setting up</h2>
          <p className="text-small text-[var(--color-muted)] mt-1">
            {act.doneCount} of {act.total} done - a few minutes each.
          </p>
        </div>
        <button onClick={dismiss} aria-label="Hide setup checklist" className="p-1.5 -mr-1 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-border-light)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-[var(--color-border-light)] overflow-hidden">
        <div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${Math.max(4, act.pct)}%` }} />
      </div>
      <ul className="mt-4 space-y-1">
        {ACTIVATION_STEPS.map((s) => {
          const done = act.steps[s.id];
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                className={`flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-lg)] ${done ? "pointer-events-none" : "hover:bg-[var(--color-canvas)]"}`}
                aria-disabled={done}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-[var(--color-success)] text-white" : "border-2 border-[var(--color-border)]"}`}>
                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className={`flex-1 text-small ${done ? "text-[var(--color-muted)] line-through" : "font-semibold text-[var(--color-ink)]"}`}>{s.label}</span>
                {!done && <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
