"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Link2, Copy, Check, ExternalLink, Plus, Trash2, Save, Calendar, Scissors, ArrowRight, MapPin, AtSign, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { toast } from "@/stores/toastStore";
import { PhotoGalleryEditor } from "@/components/booking/PhotoGalleryEditor";
import { QrCodeCard } from "@/components/booking/QrCodeCard";
import { ReviewsManager } from "@/components/booking/ReviewsManager";
import {
  DEFAULT_BOOKING_CONFIG as DEFAULTS, type BookingConfig, type BookingService as Service,
} from "@/lib/booking-profile";
import { appUrl } from "@/lib/app-url";

const BOOKING_STORAGE_KEY = "orbit_booking_link_v1";

export default function BookingLinkPage() {
  return <BookingLinkInner />;
}

function BookingLinkInner() {
  const profile = useAuthStore((s) => s.profile);
  // The auth user is known before (and even without) the profile row.
  const userId = useAuthStore((s) => s.user?.id) ?? profile?.id ?? null;
  const [config, setConfig] = useState<BookingConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);
  const [copied, setCopied] = useState(false);
  // Origin is empty during SSR, filled in once the page mounts in the browser.
  // This avoids a hydration mismatch that crashes the production build.
  const [origin, setOrigin] = useState("");
  const [mounted, setMounted] = useState(false);
  // The slug actually saved on this account. Links, the QR code and Copy only
  // ever use this - never a draft that would open a "not found" page.
  // undefined = still loading, null = never saved.
  const [savedSlug, setSavedSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    setOrigin(window.location.origin);
    if (!userId) return;
    // Per-account key: a shared key let one account's draft (and QR) show up
    // for another account signed in on the same browser.
    const raw = localStorage.getItem(`${BOOKING_STORAGE_KEY}:${userId}`);
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
    const supabase = createSupabaseClient();
    supabase
      .from("profiles")
      .select("booking_link")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        const remote = (error ? null : data?.booking_link) as Partial<BookingConfig> | null;
        setSavedSlug(remote?.slug || null);
        if (remote) setConfig((c) => ({ ...c, ...remote }));
      });
  }, [userId, profile?.business_name]);

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

  /** Photos save immediately (they're already uploaded), without touching other unsaved edits. */
  async function savePhotos(photos: string[]) {
    if (!userId) return;
    const supabase = createSupabaseClient();
    const { data } = await supabase.from("profiles").select("booking_link").eq("id", userId).maybeSingle();
    const current = (data?.booking_link as BookingConfig | null) ?? null;
    if (!current?.slug) return; // first save happens with the Save button
    const { error } = await supabase.from("profiles").update({ booking_link: { ...current, photos } }).eq("id", userId);
    if (error) toast("Couldn't save photos - press Save to try again.", "danger");
  }

  async function handleSave() {
    if (!userId) {
      toast("Sign in to save your booking link", "danger");
      return;
    }
    if (!config.slug.trim()) {
      toast("Pick a URL slug first", "danger");
      return;
    }
    setSaving(true);

    // Always write to localStorage for fast local hydration next time
    localStorage.setItem(`${BOOKING_STORAGE_KEY}:${userId}`, JSON.stringify(config));

    // Persist to the database so the public /book/<slug> page can look it up.
    // Falls back gracefully if the booking_link column doesn't exist yet.
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("profiles")
        .update({ booking_link: config })
        .eq("id", userId);
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
        setSavedSlug(config.slug);
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
  // Always the official domain (NEXT_PUBLIC_APP_URL), so a QR printed while
  // using an old address or a test server still points clients to the right place.
  const base = appUrl(origin);
  const url = mounted && savedSlug ? `${base}/book/${savedSlug}` : "";
  const draftUrl = mounted ? `${base}/book/${config.slug || "your-name"}` : "";
  const unsavedSlug = !!savedSlug && config.slug !== savedSlug;

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-page font-bold">Booking link</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">
            One public URL clients can use to book themselves in.
          </p>
        </div>
        <Link
          href="/branding"
          className="text-tiny font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-primary)] whitespace-nowrap pt-1"
        >
          Customize appearance
        </Link>
      </div>

      {/* URL card */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
        <div className="flex items-center gap-3 mb-3">
          <Link2 className="h-5 w-5 text-[var(--color-primary)]" />
          <h3 className="text-card-title font-semibold">Your public link</h3>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 pl-4 pr-2 sm:px-5 py-2 sm:py-4 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]">
          <span className="flex-1 min-w-0 text-small sm:text-body font-mono text-[var(--color-ink-mid)] truncate">
            {url || draftUrl || "Loading..."}
          </span>
          <button
            onClick={handleCopy}
            disabled={!url}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-small font-semibold bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {copied ? <><Check className="h-4 w-4 text-[var(--color-success)]" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
          </button>
          <a
            href={url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors flex-shrink-0 ${url ? "" : "opacity-50 pointer-events-none"}`}
            aria-label="Open link"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        {savedSlug === null ? (
          <p className="mt-3 text-small font-semibold text-[var(--color-warning-deep)]">
            Not live yet - choose your link below and press Save to switch it on.
          </p>
        ) : unsavedSlug ? (
          <p className="mt-3 text-small font-semibold text-[var(--color-warning-deep)]">
            You changed your link to &ldquo;{config.slug}&rdquo; - press Save to use it. Until then your live link and QR code stay as shown above.
          </p>
        ) : (
          <p className="mt-3 text-small text-[var(--color-muted)]">
            Share this on Instagram bio, WhatsApp status, business cards - anywhere clients find you.
          </p>
        )}
      </div>

      {url && (
        <QrCodeCard url={url} businessName={profile?.business_name || profile?.full_name || "us"} />
      )}

      {/* Configuration */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-8 space-y-6">
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
          hint="Shown on your booking page as your opening hours."
        />

        <Input
          label="Location"
          icon={<MapPin className="h-4 w-4" />}
          placeholder="e.g. 12 Admiralty Way, Lekki Phase 1, Lagos"
          value={config.location ?? ""}
          onChange={(e) => update("location", e.target.value)}
          hint="Clients get a Directions button. Write 'Home service - Lagos' if you travel to them."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Instagram"
            icon={<AtSign className="h-4 w-4" />}
            placeholder="glambyamaka"
            value={config.instagram ?? ""}
            onChange={(e) => update("instagram", e.target.value.replace(/^@/, ""))}
          />
          <Input
            label="WhatsApp number"
            icon={<MessageCircle className="h-4 w-4" />}
            type="tel"
            placeholder="0803 123 4567"
            value={config.whatsapp ?? ""}
            onChange={(e) => update("whatsapp", e.target.value)}
          />
        </div>

        {userId && (
          <PhotoGalleryEditor
            userId={userId}
            photos={config.photos ?? []}
            onChange={(photos) => { update("photos", photos); void savePhotos(photos); }}
          />
        )}

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
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end px-4 sm:px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]">
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

      {userId && <ReviewsManager userId={userId} />}
    </div>
  );
}
