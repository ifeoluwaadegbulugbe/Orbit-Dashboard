"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scissors, Plus, Trash2, Save, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useServices, useUpdateServices } from "@/hooks/useServices";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import {
  DEFAULT_SERVICES_BY_TYPE,
  BUSINESS_TYPE_LABELS,
  type BusinessType,
  type Service,
} from "@/types";

/**
 * Central place for the business owner to manage the services they offer.
 * Everything else - the public booking page, the new booking dialog, the
 * invoice builder - reads from this same list.
 */
export default function ServicesPage() {
  const profile = useAuthStore((s) => s.profile);
  const { data: remoteServices = [], isLoading } = useServices();
  const update = useUpdateServices();

  // Local editable copy. We hydrate from the server list, then let the user
  // freely edit and only persist when they tap Save.
  const [services, setServices] = useState<Service[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && !isLoading) {
      setServices(remoteServices);
      setHydrated(true);
    }
  }, [remoteServices, isLoading, hydrated]);

  function updateService(i: number, patch: Partial<Service>) {
    setServices((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addService() {
    setServices((list) => [
      ...list,
      { name: "", duration_minutes: 60, price: "" },
    ]);
  }

  function removeService(i: number) {
    setServices((list) => list.filter((_, idx) => idx !== i));
  }

  function loadDefaults() {
    const type = (profile?.business_type as BusinessType) ?? "other";
    const defaults = DEFAULT_SERVICES_BY_TYPE[type] ?? DEFAULT_SERVICES_BY_TYPE.other;
    // Append, don't replace, so an owner who already has some services
    // doesn't lose them.
    setServices((list) => {
      const existing = new Set(list.map((s) => s.name.trim().toLowerCase()));
      const additions = defaults.filter((d) => !existing.has(d.name.trim().toLowerCase()));
      return [...list, ...additions];
    });
    toast("Suggestions added. Tweak and Save.", "success");
  }

  async function handleSave() {
    // Light validation: at least one service with a name
    const cleaned = services
      .map((s) => ({
        name: s.name.trim(),
        duration_minutes: Number.isFinite(s.duration_minutes) ? s.duration_minutes : 60,
        price: s.price.trim(),
      }))
      .filter((s) => s.name.length > 0);

    try {
      await update.mutateAsync(cleaned);
      setServices(cleaned);
      toast(
        cleaned.length === 0
          ? "Services list saved (empty)"
          : `Saved ${cleaned.length} ${cleaned.length === 1 ? "service" : "services"}`,
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save services", "danger");
    }
  }

  const isEmpty = !isLoading && services.length === 0;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-page font-bold">Services</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">
            Build your menu once. Clients pick from it on your booking link, and you pick
            from it when scheduling or invoicing.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/booking-link"
            className="inline-flex items-center gap-1.5 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-primary)] transition-colors"
          >
            Booking link <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 sm:p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-subtle)] mx-auto mb-5 flex items-center justify-center">
            <Scissors className="h-7 w-7 text-[var(--color-primary)]" />
          </div>
          <h2 className="text-section font-bold tracking-tight">Add your first service</h2>
          <p className="mt-3 text-body text-[var(--color-ink-light)] max-w-md mx-auto leading-relaxed">
            Each service has a name, an estimated duration, and a price. We can pre-fill
            common services for your business type if you want a head start.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={loadDefaults} leftIcon={<Sparkles className="h-4 w-4" />}>
              Use suggested services
            </Button>
            <button
              onClick={addService}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-small font-semibold bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add manually
            </button>
          </div>
          {profile?.business_type && (
            <p className="mt-4 text-tiny text-[var(--color-muted)]">
              Suggestions tailored for {BUSINESS_TYPE_LABELS[profile.business_type as BusinessType]}.
            </p>
          )}
        </div>
      )}

      {/* List */}
      {!isEmpty && (
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
                <Scissors className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div>
                <h2 className="text-card-title font-semibold">
                  {services.length} {services.length === 1 ? "service" : "services"}
                </h2>
                <p className="text-small text-[var(--color-muted)]">
                  Price can be free-form (e.g. &quot;$80&quot;, &quot;From N5,000&quot;, &quot;Free consult&quot;).
                </p>
              </div>
            </div>

            <button
              onClick={loadDefaults}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-small font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> Add suggestions
            </button>
          </div>

          {/* Loading shimmer */}
          {isLoading && !hydrated && (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-[var(--radius-lg)] skeleton" />
              ))}
            </div>
          )}

          {/* Editable rows */}
          {hydrated && (
            <div className="divide-y divide-[var(--color-border)]">
              {services.map((s, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_auto] gap-3 sm:gap-4 items-end px-6 py-4"
                >
                  <Input
                    label={i === 0 ? "Service name" : undefined}
                    placeholder="e.g. Full bridal makeup"
                    value={s.name}
                    onChange={(e) => updateService(i, { name: e.target.value })}
                  />
                  <Input
                    label={i === 0 ? "Duration (min)" : undefined}
                    type="number"
                    min={0}
                    value={s.duration_minutes}
                    onChange={(e) =>
                      updateService(i, { duration_minutes: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                  <Input
                    label={i === 0 ? "Price" : undefined}
                    placeholder="$80 or Free"
                    value={s.price}
                    onChange={(e) => updateService(i, { price: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeService(i)}
                    className="h-11 w-11 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/30 transition-colors flex items-center justify-center self-end"
                    aria-label={`Remove ${s.name || "service"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="px-6 py-4">
                <button
                  type="button"
                  onClick={addService}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-small font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add another service
                </button>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="px-6 py-5 border-t border-[var(--color-border)] flex items-center justify-end gap-3 bg-[var(--color-canvas)]/40">
            <Button
              onClick={handleSave}
              loading={update.isPending}
              leftIcon={
                update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />
              }
            >
              Save services
            </Button>
          </div>
        </div>
      )}

      {/* Helper card */}
      <div className="rounded-[var(--radius-2xl)] border border-dashed border-[var(--color-border)] bg-white/60 px-6 py-5">
        <h3 className="text-card-title font-semibold mb-1.5">Where these show up</h3>
        <ul className="text-small text-[var(--color-ink-light)] leading-relaxed space-y-1.5">
          <li>· Your public booking link (<Link href="/booking-link" className="text-[var(--color-primary)] font-semibold">manage link</Link>)</li>
          <li>· The &quot;New booking&quot; dialog in the Work tab</li>
          <li>· The invoice builder (services become invoice line items)</li>
        </ul>
      </div>
    </div>
  );
}
