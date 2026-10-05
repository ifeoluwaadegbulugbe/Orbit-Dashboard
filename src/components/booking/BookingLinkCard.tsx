"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Copy, Check, Share2, ExternalLink, Settings2, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/stores/toastStore";

const BOOKING_STORAGE_KEY = "orbit_booking_link_v1";

/**
 * Compact "your public booking link" card with copy / share / open.
 * Reads the saved slug from the profile (falls back to this browser's copy);
 * if none is set yet, nudges the owner to set it up.
 */
export function BookingLinkCard() {
  const profile = useAuthStore((s) => s.profile);
  const [slug, setSlug] = useState<string | null | undefined>(undefined); // undefined = loading
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    let local: string | null = null;
    try {
      local = JSON.parse(localStorage.getItem(BOOKING_STORAGE_KEY) ?? "null")?.slug || null;
    } catch {
      // ignore
    }
    if (!profile?.id) { setSlug(local); return; }
    createClient()
      .from("profiles")
      .select("booking_link")
      .eq("id", profile.id)
      .maybeSingle()
      .then(({ data }) => {
        const remote = (data?.booking_link as { slug?: string } | null)?.slug;
        setSlug(remote || local);
      });
  }, [profile?.id]);

  const url = slug && origin ? `${origin}/book/${slug}` : "";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Couldn't copy - long-press the link to copy it instead.", "danger");
    }
  }

  async function share() {
    if (!url) return;
    const text = `Book an appointment with ${profile?.business_name || "me"} here:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Book an appointment", text, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
  }

  if (slug === undefined) return <div className="h-[76px] rounded-[var(--radius-2xl)] skeleton" />;

  if (!slug) {
    return (
      <Link
        href="/booking-link"
        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 bg-white rounded-[var(--radius-2xl)] border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
          <Link2 className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold text-[var(--color-ink)]">Set up your booking link</div>
          <div className="text-small text-[var(--color-ink-light)]">Let clients book themselves in from one link.</div>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--color-muted)] flex-shrink-0" />
      </Link>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-4 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
          <Link2 className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <div className="min-w-0">
          <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">Your booking link</div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="block text-small font-semibold text-[var(--color-ink)] truncate hover:text-[var(--color-primary)]">
            {url.replace(/^https?:\/\//, "")}
          </a>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={copy}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-white border border-[var(--color-border)] text-small font-semibold hover:border-[var(--color-primary)]/40 transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-primary)] text-white text-small font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open booking page"
          title="Open booking page"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-ink-light)] hover:bg-[var(--color-border-light)] flex-shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <Link
          href="/booking-link"
          aria-label="Edit booking link"
          title="Edit booking link"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-ink-light)] hover:bg-[var(--color-border-light)] flex-shrink-0"
        >
          <Settings2 className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
