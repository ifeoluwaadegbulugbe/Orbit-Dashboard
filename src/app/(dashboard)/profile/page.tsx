"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, Settings, Globe, CreditCard, FileText, LogOut, ExternalLink, Check,
  Camera, Edit2, X, Save, ChevronRight, Lock, Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import { useAuthStore } from "@/stores/authStore";
import { useSubscription } from "@/hooks/useSubscription";
import { useCurrencyStore } from "@/stores/currencyStore";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_TYPE_LABELS } from "@/types";
import { PRO_PRICE_DISPLAY, PRO_PRICE_PERIOD } from "@/lib/constants";
import { COUNTRIES, type Country } from "@/lib/countries";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="h-12 rounded-xl skeleton" />}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const user = useAuthStore((s) => s.user);
  const { isPro, isOnTrial, trialDaysLeft } = useSubscription();
  const country = useCurrencyStore((s) => s.country);
  const setCountry = useCurrencyStore((s) => s.setCountry);
  const search = useSearchParams();
  const router = useRouter();

  const [paywallOpen, setPaywallOpen] = useState(search.get("upgrade") === "1");
  const [portalLoading, setPortalLoading] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  // Editing state
  const [editingName, setEditingName] = useState(false);
  const [editingBusinessName, setEditingBusinessName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [businessDraft, setBusinessDraft] = useState("");
  const [savingField, setSavingField] = useState<"name" | "business" | "avatar" | null>(null);

  // Currency picker
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show a confirmation banner after Paystack returns
  useEffect(() => {
    const status = search.get("paystack");
    if (!status) return;
    if (status === "success") {
      setBanner({ tone: "success", text: "🎉 Payment successful! Your Pro features are unlocked." });
    } else if (status === "failed") {
      setBanner({ tone: "danger", text: "Payment was cancelled or failed. No charge was made." });
    } else {
      setBanner({ tone: "danger", text: `Something went wrong: ${status}` });
    }
    router.replace("/profile", { scroll: false });
  }, [search, router]);

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Your Name";
  const businessTypeLabel = profile?.business_type ? BUSINESS_TYPE_LABELS[profile.business_type] : "Business";

  // ─── Updaters ─────────────────────────────────────────────────────────────

  async function updateProfileField(patch: Record<string, unknown>) {
    if (!user?.id) return;
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) {
      setBanner({ tone: "danger", text: `Could not save: ${error.message}` });
      return false;
    }
    // Optimistic update
    setProfile(profile ? { ...profile, ...patch } : profile);
    return true;
  }

  async function saveName() {
    setSavingField("name");
    const ok = await updateProfileField({ full_name: nameDraft.trim() || profile?.full_name });
    setSavingField(null);
    if (ok) setEditingName(false);
  }

  async function saveBusiness() {
    setSavingField("business");
    const ok = await updateProfileField({ business_name: businessDraft.trim() || null });
    setSavingField(null);
    if (ok) setEditingBusinessName(false);
  }

  async function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setBanner({ tone: "danger", text: "Image must be under 2MB." });
      return;
    }
    setSavingField("avatar");
    try {
      // Convert to a resized data URL (max 512px) to keep DB row small
      const dataUrl = await fileToResizedDataUrl(file, 512);
      await updateProfileField({ avatar_url: dataUrl });
    } catch (err) {
      setBanner({ tone: "danger", text: err instanceof Error ? err.message : "Could not upload image." });
    } finally {
      setSavingField(null);
      // Reset so picking the same file twice still triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    if (!confirm("Remove your profile picture?")) return;
    setSavingField("avatar");
    await updateProfileField({ avatar_url: null });
    setSavingField(null);
  }

  function handleCountrySelect(c: Country) {
    setCountry(c);
    setCurrencyPickerOpen(false);
    // Persist to Supabase so the same currency follows the user across devices.
    // Silently no-op if the country_code column isn't there yet.
    if (user?.id) {
      const supabase = createClient();
      supabase
        .from("profiles")
        .update({ country_code: c.code })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.warn("[orbit] could not save country to profile:", error.message);
        });
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/paystack/portal");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not open portal";
      setBanner({ tone: "danger", text: msg });
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-page font-bold">Profile</h1>

      {banner && (
        <div
          className={`px-5 py-4 rounded-[var(--radius-lg)] text-body ${
            banner.tone === "success"
              ? "bg-[var(--color-success-light)] text-[var(--color-success-deep)]"
              : "bg-[var(--color-danger-light)] text-[var(--color-danger-deep)]"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* ─── Hero card with editable avatar ─── */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 flex items-center gap-6">
        <div className="relative flex-shrink-0">
          <Avatar name={displayName} imageUrl={profile?.avatar_url} size={84} />
          <button
            onClick={handleAvatarClick}
            disabled={savingField === "avatar"}
            className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white flex items-center justify-center border-4 border-white shadow-soft transition-colors disabled:opacity-50"
            aria-label="Change profile picture"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFile}
            className="hidden"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-section font-bold text-[var(--color-ink)] truncate">{displayName}</h2>
          <p className="text-body text-[var(--color-ink-light)] mt-1">{businessTypeLabel}</p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {isOnTrial && trialDaysLeft !== null ? (
              <Badge tone="primary" icon={<Sparkles className="h-3 w-3" />}>
                Pro Trial · {trialDaysLeft}d left
              </Badge>
            ) : isPro ? (
              <Badge tone="primary" icon={<Sparkles className="h-3 w-3" />}>
                Pro Plan
              </Badge>
            ) : (
              <Badge tone="neutral">Free Plan</Badge>
            )}
            {profile?.avatar_url && (
              <button
                onClick={handleRemoveAvatar}
                className="text-tiny font-semibold text-[var(--color-muted)] hover:text-[var(--color-danger)]"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Subscription card ─── */}
      <SectionCard title="Subscription" icon={<CreditCard className="h-4 w-4 text-[var(--color-primary)]" />}>
        {isPro ? (
          <div className="px-7 py-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[var(--color-success-light)] flex items-center justify-center flex-shrink-0">
                <Check className="h-5 w-5 text-[var(--color-success-deep)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body font-semibold text-[var(--color-ink)]">
                  {isOnTrial ? `Trial · ${trialDaysLeft} days remaining` : "Pro Plan active"}
                </div>
                <div className="text-small text-[var(--color-muted)] mt-1">
                  {isOnTrial
                    ? `Auto-renews to ${PRO_PRICE_DISPLAY}${PRO_PRICE_PERIOD} after trial ends.`
                    : `${PRO_PRICE_DISPLAY}${PRO_PRICE_PERIOD} · billed monthly via Paystack`}
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              loading={portalLoading}
              rightIcon={<ExternalLink className="h-4 w-4" />}
              onClick={handleManageSubscription}
            >
              Manage subscription
            </Button>
          </div>
        ) : (
          <div className="px-7 py-6 space-y-4">
            <p className="text-body text-[var(--color-ink-light)] leading-relaxed">
              You&apos;re on the Free plan. Upgrade to unlock unlimited clients, AI tools, automations, online payments and more.
            </p>
            <Button
              size="md"
              fullWidth
              leftIcon={<Sparkles className="h-4 w-4" />}
              onClick={() => setPaywallOpen(true)}
            >
              Upgrade to Pro
            </Button>
          </div>
        )}
      </SectionCard>

      {/* ─── Personal info (editable) ─── */}
      <SectionCard title="Personal info" icon={<Settings className="h-4 w-4 text-[var(--color-primary)]" />}>
        <EditableRow
          label="Name"
          value={displayName}
          editing={editingName}
          draft={nameDraft}
          saving={savingField === "name"}
          onEdit={() => { setNameDraft(profile?.full_name ?? ""); setEditingName(true); }}
          onDraftChange={setNameDraft}
          onSave={saveName}
          onCancel={() => setEditingName(false)}
        />
        <Row label="Email" value={user?.email ?? "-"} />
        <EditableRow
          label="Business"
          value={profile?.business_name ?? "Not set"}
          editing={editingBusinessName}
          draft={businessDraft}
          saving={savingField === "business"}
          onEdit={() => { setBusinessDraft(profile?.business_name ?? ""); setEditingBusinessName(true); }}
          onDraftChange={setBusinessDraft}
          onSave={saveBusiness}
          onCancel={() => setEditingBusinessName(false)}
        />
        <Row label="Business type" value={businessTypeLabel} />
      </SectionCard>

      {/* ─── Currency & region (now functional) ─── */}
      <SectionCard title="Currency & region" icon={<Globe className="h-4 w-4 text-[var(--color-primary)]" />}>
        <button
          onClick={() => setCurrencyPickerOpen(true)}
          className="w-full flex items-center justify-between px-7 py-4 hover:bg-[var(--color-canvas)] transition-colors text-left"
        >
          <span className="text-body text-[var(--color-ink-light)]">Country & currency</span>
          <span className="inline-flex items-center gap-2 text-body font-medium">
            <span>{country.flag}</span>
            <span>{country.name}</span>
            <span className="text-[var(--color-muted)]">· {country.currency}</span>
            <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
          </span>
        </button>
      </SectionCard>

      {/* ─── Security ─── */}
      <SectionCard title="Security" icon={<Lock className="h-4 w-4 text-[var(--color-primary)]" />}>
        <ChangePasswordRow />
      </SectionCard>

      {/* ─── Legal ─── */}
      <SectionCard title="Legal" icon={<FileText className="h-4 w-4 text-[var(--color-primary)]" />}>
        <RowLink label="Terms of Service" href="/terms" />
        <RowLink label="Privacy Policy"   href="/privacy" />
      </SectionCard>

      {/* ─── Sign out ─── */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] text-body font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/30 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>

      <p className="text-center text-tiny text-[var(--color-muted)] py-2">Orbit · v1.0.0</p>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />

      {/* Currency picker dialog */}
      <Dialog open={currencyPickerOpen} onClose={() => setCurrencyPickerOpen(false)} title="Pick your country">
        <div className="max-h-[60vh] overflow-y-auto -mx-6">
          <div className="divide-y divide-[var(--color-border)]">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => handleCountrySelect(c)}
                className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-[var(--color-canvas)] transition-colors text-left"
              >
                <span className="text-2xl flex-shrink-0">{c.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold truncate">{c.name}</div>
                  <div className="text-small text-[var(--color-muted)]">
                    {c.currency} · {c.symbol}
                  </div>
                </div>
                {country.code === c.code && (
                  <Check className="h-5 w-5 text-[var(--color-primary)] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
      <div className="flex items-center gap-2 px-7 py-5 border-b border-[var(--color-border)]">
        {icon}
        <h3 className="text-card-title font-semibold text-[var(--color-ink)]">{title}</h3>
      </div>
      <div className="divide-y divide-[var(--color-border)]">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-7 py-4">
      <span className="text-body text-[var(--color-ink-light)]">{label}</span>
      <span className="text-body font-medium text-[var(--color-ink)] truncate ml-4">{value}</span>
    </div>
  );
}

function EditableRow({
  label, value, editing, draft, saving,
  onEdit, onDraftChange, onSave, onCancel,
}: {
  label: string;
  value: string;
  editing: boolean;
  draft: string;
  saving: boolean;
  onEdit: () => void;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <div className="px-7 py-4 flex items-center gap-3">
        <span className="text-body text-[var(--color-ink-light)] w-24 flex-shrink-0">{label}</span>
        <Input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          className="flex-1"
        />
        <button
          onClick={onSave}
          disabled={saving}
          className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
          aria-label="Save"
        >
          <Save className="h-4 w-4" />
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="w-9 h-9 rounded-full text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-border-light)] flex items-center justify-center transition-colors disabled:opacity-50"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onEdit}
      className="w-full flex items-center justify-between px-7 py-4 hover:bg-[var(--color-canvas)] transition-colors text-left group"
    >
      <span className="text-body text-[var(--color-ink-light)]">{label}</span>
      <span className="inline-flex items-center gap-2">
        <span className="text-body font-medium text-[var(--color-ink)] truncate">{value}</span>
        <Edit2 className="h-3.5 w-3.5 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    </button>
  );
}

function RowLink({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-7 py-4 hover:bg-[var(--color-canvas)] transition-colors"
    >
      <span className="text-body text-[var(--color-ink)]">{label}</span>
      <ExternalLink className="h-4 w-4 text-[var(--color-muted)]" />
    </Link>
  );
}

/**
 * Inline change-password row inside the Security section card. Collapsed by
 * default so the section reads "Password ... Change" until the user wants to
 * actually do it. Uses supabase.auth.updateUser({password}) - Supabase doesn't
 * require the old password to be re-entered because the session already
 * proves identity, but we still ask for it as a soft confirmation step.
 */
function ChangePasswordRow() {
  const [open, setOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const user = useAuthStore((s) => s.user);

  function reset() {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setFeedback(null);
  }

  async function handleSave() {
    setFeedback(null);
    if (newPw.length < 8) {
      setFeedback({ tone: "danger", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setFeedback({ tone: "danger", text: "New passwords don't match." });
      return;
    }
    if (!user?.email) {
      setFeedback({ tone: "danger", text: "No email on file. Sign out and back in to fix." });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      // 1. Soft re-auth with the current password. Catches typos and stops
      //    someone with momentary device access from changing the password.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (signInErr) {
        throw new Error("Current password is wrong. Try again.");
      }

      // 2. Update to the new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) throw new Error(updateErr.message);

      setFeedback({ tone: "success", text: "Password updated. You're still signed in." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setOpen(false);
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Could not change password",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setFeedback(null); }}
        className="w-full flex items-center justify-between px-7 py-4 hover:bg-[var(--color-canvas)] transition-colors text-left"
      >
        <div>
          <div className="text-body text-[var(--color-ink)]">Password</div>
          <div className="text-tiny text-[var(--color-muted)] mt-0.5">Update your sign-in password</div>
        </div>
        <span className="text-small font-semibold text-[var(--color-primary)]">Change</span>
      </button>
    );
  }

  return (
    <div className="px-7 py-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-body font-semibold text-[var(--color-ink)]">Change password</div>
          <div className="text-tiny text-[var(--color-muted)] mt-0.5">
            We&apos;ll verify your current password first.
          </div>
        </div>
        <button
          onClick={() => { setOpen(false); reset(); }}
          className="p-1 rounded hover:bg-[var(--color-canvas)]"
          aria-label="Cancel"
        >
          <X className="h-4 w-4 text-[var(--color-ink-light)]" />
        </button>
      </div>

      {feedback && (
        <div
          className={`px-3 py-2 rounded-[var(--radius-md)] text-small ${
            feedback.tone === "success"
              ? "bg-[var(--color-success-light)] text-[var(--color-success-deep)]"
              : "bg-[var(--color-danger-light)] text-[var(--color-danger-deep)]"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPw}
        onChange={(e) => setCurrentPw(e.target.value)}
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirmPw}
        onChange={(e) => setConfirmPw(e.target.value)}
      />

      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={handleSave}
          disabled={saving || !currentPw || !newPw || !confirmPw}
          leftIcon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        >
          {saving ? "Updating..." : "Save new password"}
        </Button>
        <button
          onClick={() => { setOpen(false); reset(); }}
          className="px-4 py-2 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Image resizing helper ──────────────────────────────────────────────────

async function fileToResizedDataUrl(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not available"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
