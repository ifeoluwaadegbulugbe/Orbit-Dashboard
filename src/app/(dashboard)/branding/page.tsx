"use client";

import { useState, useEffect } from "react";
import { Palette, Save, Image as ImageIcon } from "lucide-react";
import { ProGate } from "@/components/paywall/ProGate";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

const BRANDING_STORAGE_KEY = "orbit_branding_v1";

interface Branding {
  business_name: string;
  tagline: string;
  logo_url: string;
  accent_color: string;
  invoice_footer: string;
}

const DEFAULTS: Branding = {
  business_name: "",
  tagline: "",
  logo_url: "",
  accent_color: "#E8557A",
  invoice_footer: "Thank you for your business!",
};

const ACCENT_PRESETS = [
  "#E8557A", "#F59E0B", "#22C55E", "#6366F1",
  "#06B6D4", "#8B5CF6", "#EC4899", "#1F2937",
];

export default function BrandingPage() {
  return (
    <ProGate
      title="Branding"
      description="Make every invoice, booking confirmation and payment link look like yours. Logo, colour, tagline - all in one place."
    >
      <BrandingForm />
    </ProGate>
  );
}

function BrandingForm() {
  const [branding, setBranding] = useState<Branding>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (raw) {
      try {
        setBranding({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {
        // ignore
      }
    }
  }, []);

  function update<K extends keyof Branding>(key: K, value: Branding[K]) {
    setBranding((b) => ({ ...b, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
    // Tiny delay so user sees the loading state
    await new Promise((r) => setTimeout(r, 300));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-page font-bold">Branding</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          The look and feel of every customer-facing touchpoint.
        </p>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-[var(--color-border)]">
          <h3 className="text-card-title font-semibold">Preview</h3>
        </div>
        <div className="p-8" style={{ backgroundColor: branding.accent_color + "0D" }}>
          <div className="flex items-center gap-4">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt=""
                className="w-14 h-14 rounded-xl object-cover bg-white border border-[var(--color-border)]"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: branding.accent_color }}
              >
                {(branding.business_name || "O").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-card-title font-bold" style={{ color: branding.accent_color }}>
                {branding.business_name || "Your business name"}
              </div>
              <div className="text-small text-[var(--color-ink-mid)] mt-0.5">
                {branding.tagline || "Your tagline appears here"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 space-y-6">
        <Input
          label="Business name"
          placeholder="e.g. Glam by Amaka"
          value={branding.business_name}
          onChange={(e) => update("business_name", e.target.value)}
        />

        <Input
          label="Tagline"
          placeholder="e.g. Bridal makeup & glam in Lagos"
          value={branding.tagline}
          onChange={(e) => update("tagline", e.target.value)}
          hint="Short phrase that appears under your name on invoices."
        />

        <Input
          label="Logo URL"
          placeholder="https://… (upload to a CDN and paste here)"
          icon={<ImageIcon className="h-4 w-4" />}
          value={branding.logo_url}
          onChange={(e) => update("logo_url", e.target.value)}
          hint="Optional. Paste a public image URL - Cloudinary, Imgur, or your own."
        />

        <div>
          <label className="block text-small font-semibold mb-2">Accent colour</label>
          <div className="flex items-center gap-3 flex-wrap">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update("accent_color", c)}
                aria-label={`Pick ${c}`}
                className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                  branding.accent_color === c
                    ? "border-[var(--color-ink)] scale-110"
                    : "border-white shadow-soft-sm"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={branding.accent_color}
              onChange={(e) => update("accent_color", e.target.value)}
              className="w-10 h-10 rounded-full border-2 border-[var(--color-border)] cursor-pointer"
              aria-label="Custom color"
            />
          </div>
          <p className="mt-2 text-tiny text-[var(--color-muted)]">
            Used for invoice headers, payment buttons and other accents.
          </p>
        </div>

        <Textarea
          label="Invoice footer"
          placeholder="Thank you for your business!"
          value={branding.invoice_footer}
          onChange={(e) => update("invoice_footer", e.target.value)}
          hint="Appears at the bottom of every invoice you send."
        />

        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
          <div className="inline-flex items-center gap-2 text-small text-[var(--color-muted)]">
            <Palette className="h-4 w-4" />
            Saved locally on this device
          </div>
          <Button
            onClick={handleSave}
            loading={saving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {saved ? "Saved!" : "Save branding"}
          </Button>
        </div>
      </div>
    </div>
  );
}
