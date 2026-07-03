"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Link2, Copy, Check, ExternalLink, Plus, Trash2, Save, Calendar, Scissors, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { toast } from "@/stores/toastStore";

const BOOKING_STORAGE_KEY = "orbit_booking_link_v1";

interface Service {
  name: string;
  duration_minutes: number;
  price: string;
}

interface BookingConfig {
  slug: string;
  intro: string;
  services: Service[];
  availability: string;
}

const DEFAULTS: BookingConfig = {
  slug: "",
  intro: "Pick a service and a time that works for you. I'll confirm by message within an hour.",
  services: [
    { name: "Initial consultation", duration_minutes: 30, price: "Free" },
  ],
  availability: "Mon–Fri · 9am–6pm",
};

export default function BookingLinkPage() {
  return <BookingLinkInner />;
}

function BookingLinkInner() {
  const profile = useAuthStore((s) => s.profile);
  const [config, setConfig] = useState<BookingConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);
  const [copied, setCopied] = useState(false);
  // Origin is empty during SSR, filled in once the page mounts in the browser.
  // This avoids a hydration mismatch that crashes the production build.
  const [origin, setOrigin] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOrigin(window.location.origin);
    const raw = localStorage.getItem(BOOKING_STORAGE_KEY);
    if (raw) {
      try {
        setConfig({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {
        // ignore
      }
    } else if (profile?.business_name) {
      // Suggest a slug from business name on first load
      const suggested = profile.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      setConfig((c) => ({ ...c, slug: suggested }));
    }

    // Always pull the latest config from the database so changes made on the
    // /services page (or another device) show up here. Falls back silently.
    if (profile?.id) {
      const supabase = createSupabaseClient();
      supabase
        .from("profiles")
        .select("booking_link")
        .eq("id", profile.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data?.booking_link) return;
          const remote = data.booking_link as Partial<BookingConfig>;
          setConfig((c) => ({ ...c, ...remote }));
        });
    }
  }, [profile?.id, profile?.business_name]);

  function update<K extends keyof BookingConfig>(key: K, value: BookingConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function updateService(i: number, patch: Partial<Service>) {
    setConfig((c) => ({
      ...c,
      services: c.services.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  }

  function addService() {
    setConfig((c) => ({
      ...c,
      services: [...c.services, { name: "", duration_minutes: 60, price: "" }],
    }));
  }

  function removeService(i: number) {
    setConfig((c) => ({
      ...c,
      services: c.services.filter((_, idx) => idx !== i),
    }));
  }

  async function handleSave() {
    if (!profile?.id) {
      toast("Sign in to save your booking link", "danger");
      return;
    }
    if (!config.slug.trim()) {
      toast("Pick a URL slug first", "danger");
      return;
    }
    setSaving(true);

    // Always write to localStorage for fast local hydration next time
    localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(config));

    // Persist to the database so the public /book/<slug> page can look it up.
    // Falls back gracefully if the booking_link column doesn't exist yet.
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("profiles")
        .update({ booking_link: config })
        .eq("id", profile.id);
      if (error) {
        if (error.message?.toLowerCase().includes("column") || error.code === "42703") {
          toast(
            "Saved locally. Run: ALTER TABLE profiles ADD COLUMN booking_link jsonb; to enable the public page.",
            "danger",
          );
        } else {
          toast(error.message, "danger");
        }
      } else {
        toast("Booking link saved", "success");
      }
    } catch (err) {
      console.warn("[booking-link] could not sync to DB:", err);
    }

    setSaving(false);
    setSavedRecently(true);
    setTimeout(() => setSavedRecently(false), 2500);
  }

  // Until we mount, render an empty URL placeholder so server-rendered HTML
  // matches the first client render. After mount, origin is the real one.
  const base = origin || "";
  const url = mounted
    ? (config.slug ? `${base}/book/${config.slug}` : `${base}/book/your-name`)
    : "";

  async function handleCopy() {
    if (!config.slug) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-page font-bold">Booking link</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          One public URL clients can use to book themselves in.
        </p>
      </div>

      {/* URL card */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7">
        <div className="flex items-center gap-3 mb-3">
          <Link2 className="h-5 w-5 text-[var(--color-primary)]" />
          <h3 className="text-card-title font-semibold">Your public link</h3>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]">
          <span className="flex-1 text-body font-mono text-[var(--color-ink-mid)] truncate">
            {url || "Loading..."}
          </span>
          <button
            onClick={handleCopy}
            disabled={!config.slug}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-semibold bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-colors disabled:opacity-50"
          >
            {copied ? <><Check className="h-4 w-4 text-[var(--color-success)]" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
            aria-label="Open link"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-3 text-small text-[var(--color-muted)]">
          Share this on Instagram bio, WhatsApp status, business cards - anywhere clients find you.
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 space-y-6">
        <Input
          label="URL slug"
          placeholder="e.g. glam-by-amaka"
          value={config.slug}
          onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          hint="Lowercase letters, numbers, and dashes only."
        />

        <Input
          label="Intro message"
          placeholder="What clients see when they open your link"
          value={config.intro}
          onChange={(e) => update("intro", e.target.value)}
        />

        <Input
          label="Availability summary"
          icon={<Calendar className="h-4 w-4" />}
          placeholder="e.g. Mon–Fri · 9am–6pm"
          value={config.availability}
          onChange={(e) => update("availability", e.target.value)}
          hint="A human-readable summary. Detailed calendar settings come from your Work tab."
        />

        {/* Services - inline editor kept for convenience, but the dedicated
            Services page is the canonical place. We surface a clear pointer
            so users discover it. */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-small font-semibold">Services offered</label>
            <button
              type="button"
              onClick={addService}
              className="inline-flex items-center gap-1 text-small font-semibold text-[var(--color-primary)]"
            >
              <Plus className="h-3.5 w-3.5" /> Add service
            </button>
          </div>

          <Link
            href="/services"
            className="mb-3 flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-primary-subtle)] hover:bg-[var(--color-primary-subtle)]/70 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
              <Scissors className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-small font-semibold text-[var(--color-ink)]">
                Manage your full services list
              </div>
              <div className="text-tiny text-[var(--color-ink-light)] mt-0.5">
                Edit prices, durations, and reuse them everywhere in Orbit.
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--color-primary)] group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <div className="space-y-3">
            {config.services.map((s, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]">
                <Input
                  label={i === 0 ? "Service name" : undefined}
                  placeholder="e.g. Full bridal makeup"
                  value={s.name}
                  onChange={(e) => updateService(i, { name: e.target.value })}
                />
                <Input
                  label={i === 0 ? "Duration (min)" : undefined}
                  type="number"
                  className="w-24"
                  value={s.duration_minutes}
                  onChange={(e) => updateService(i, { duration_minutes: parseInt(e.target.value, 10) || 0 })}
                />
                <Input
                  label={i === 0 ? "Price" : undefined}
                  className="w-28"
                  placeholder="e.g. $80"
                  value={s.price}
                  onChange={(e) => updateService(i, { price: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeService(i)}
                  className="h-11 w-11 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/30 transition-colors flex items-center justify-center"
                  aria-label="Remove service"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-[var(--color-border)]">
          <Button onClick={handleSave} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            {savedRecently ? "Saved!" : "Save link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
