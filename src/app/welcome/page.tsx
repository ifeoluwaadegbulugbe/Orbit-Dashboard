"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles, Globe, UserPlus, Calendar, Check, Plus, Trash2, Scissors,
  Brush, Palette, BookOpen, Camera, Dumbbell, Laptop2, Wrench, Home, MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { useCurrencyStore } from "@/stores/currencyStore";
import { useCreateClient } from "@/hooks/useClients";
import { useCreateBooking } from "@/hooks/useBookings";
import { useUpdateServices } from "@/hooks/useServices";
import { createClient as createSupabase } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import {
  BUSINESS_TYPE_LABELS,
  DEFAULT_SERVICES_BY_TYPE,
  type BusinessType,
  type Service,
  type UserProfile,
} from "@/types";

type Step = "business_type" | "services" | "currency" | "client" | "booking" | "success";

const STEP_ORDER: Step[] = ["business_type", "services", "currency", "client", "booking", "success"];
const PROGRESS_STEPS: Step[] = ["business_type", "services", "currency", "client", "booking"]; // exclude success

const BUSINESS_TYPE_ICONS: Record<BusinessType, LucideIcon> = {
  nail_tech:        Palette,
  makeup_artist:    Brush,
  tutor:            BookOpen,
  photographer:     Camera,
  personal_trainer: Dumbbell,
  freelancer:       Laptop2,
  event_planner:    Sparkles,
  repair_tech:      Wrench,
  home_service:     Home,
  other:            MoreHorizontal,
};

const WIZARD_DONE_KEY = "orbit_wizard_done_v1";

export default function WelcomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const country = useCurrencyStore((s) => s.country);
  const setCountry = useCurrencyStore((s) => s.setCountry);
  const createClient = useCreateClient();
  const createBooking = useCreateBooking();
  const updateServices = useUpdateServices();

  const [step, setStep] = useState<Step>("business_type");
  const [businessType, setBusinessType] = useState<BusinessType>(
    (profile?.business_type as BusinessType) ?? "nail_tech",
  );
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [createdClientName, setCreatedClientName] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Services list - seeded with defaults for the chosen business type.
  const [services, setServices] = useState<Service[]>(() => DEFAULT_SERVICES_BY_TYPE.nail_tech);

  // Per-step form values
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [service, setService] = useState("");
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function next() {
    const i = STEP_ORDER.indexOf(step);
    if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]);
  }

  function back() {
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]);
  }

  // Ensure a profile row exists for this user. Two scenarios converge here:
  //   1. User signed up with email confirmation ON - the signup page couldn't
  //      insert the profile (RLS blocked it before verification). We need to
  //      create it now, using the metadata they entered on signup.
  //   2. User signed up with confirmation OFF - the signup page already
  //      inserted it. We just hydrate the store.
  // Upsert with the metadata from user_metadata so both flows converge.
  useEffect(() => {
    if (!user?.id) return;
    if (profile) return;                  // already hydrated, nothing to do

    const supabase = createSupabase();
    // user_metadata was populated during signUp() via options.data
    const meta = (user.user_metadata ?? {}) as {
      full_name?: string;
      business_name?: string | null;
      business_type?: BusinessType;
    };

    (async () => {
      // First try to read - if a row already exists, we're done.
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (existing) {
        setProfile(existing as UserProfile);
        return;
      }

      // No row yet - this is the post-verification path. Build it from
      // metadata, falling back to sensible defaults so we never crash.
      const { data: created } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email ?? "",
          full_name: meta.full_name ?? user.email?.split("@")[0] ?? "there",
          business_name: meta.business_name ?? null,
          business_type: meta.business_type ?? "other",
          subscription_status: "free",
        })
        .select("*")
        .maybeSingle();
      if (created) setProfile(created as UserProfile);
    })();
  }, [user?.id, user?.email, user?.user_metadata, profile, setProfile]);

  async function persistBusinessType() {
    if (!user?.id) return;          // only the user.id is required - profile may not be hydrated yet
    setSaving(true);
    try {
      const supabase = createSupabase();
      const { data } = await supabase
        .from("profiles")
        .update({ business_type: businessType })
        .eq("id", user.id)
        .select("*")
        .single();
      // Refresh the store with the row that just came back (or merge into
      // whatever was already there).
      if (data) {
        setProfile(data as UserProfile);
      } else if (profile) {
        setProfile({ ...profile, business_type: businessType });
      }
      setServices(DEFAULT_SERVICES_BY_TYPE[businessType] ?? DEFAULT_SERVICES_BY_TYPE.other);
    } catch (err) {
      console.warn("[welcome] could not save business type:", err);
      // Still update services UI so the wizard can continue
      setServices(DEFAULT_SERVICES_BY_TYPE[businessType] ?? DEFAULT_SERVICES_BY_TYPE.other);
    } finally {
      setSaving(false);
      next();                       // ALWAYS advance - the wizard is optional and never blocks
    }
  }

  // ── Services helpers (used only on the services step) ──────────────────

  function updateService(i: number, patch: Partial<Service>) {
    setServices((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addService() {
    setServices((list) => [...list, { name: "", duration_minutes: 60, price: "" }]);
  }

  function removeService(i: number) {
    setServices((list) => list.filter((_, idx) => idx !== i));
  }

  async function persistServices() {
    // Filter out blank rows so we don't save empty services
    const cleaned = services
      .map((s) => ({
        name: s.name.trim(),
        duration_minutes: Number.isFinite(s.duration_minutes) ? s.duration_minutes : 60,
        price: s.price.trim(),
      }))
      .filter((s) => s.name.length > 0);

    setSaving(true);
    try {
      await updateServices.mutateAsync(cleaned);
    } catch {
      // Don't block the wizard - they can edit again from /services later
    } finally {
      setSaving(false);
      next();
    }
  }

  function handlePickCountry(c: typeof country) {
    setCountry(c);
    // Best-effort sync to Supabase so the same currency follows the user across devices.
    if (user?.id) {
      const supabase = createSupabase();
      supabase
        .from("profiles")
        .update({ country_code: c.code })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.warn("[orbit] could not save country to profile:", error.message);
        });
    }
  }

  async function handleAddClient() {
    if (!clientName.trim() || !clientPhone.trim()) return;
    setSaving(true);
    try {
      const phone = clientPhone.trim();
      const newClient = await createClient.mutateAsync({
        name: clientName.trim(),
        phone,
        whatsapp_number: phone,
        email: null,
        status: "active",
        birthday: null,
        notes: null,
        preferences: null,
        // Fall back to "other" if the profile hasn't hydrated yet - users can
        // change business type later from their profile page.
        business_type: profile?.business_type ?? businessType ?? "other",
        last_contacted: new Date().toISOString(),
      });
      setCreatedClientId(newClient.id);
      setCreatedClientName(newClient.name);
    } catch {
      // Continue regardless - wizard is optional
    } finally {
      setSaving(false);
      next();
    }
  }

  async function handleAddBooking() {
    if (!createdClientId || !service.trim()) {
      next();
      return;
    }
    setSaving(true);
    try {
      await createBooking.mutateAsync({
        client_id: createdClientId,
        client_name: createdClientName,
        title: service.trim(),
        date: bookingDate,
        time: "10:00",
        status: "confirmed",
        notes: null,
        business_type: profile?.business_type ?? businessType ?? "other",
      });
    } catch {
      // continue
    } finally {
      setSaving(false);
      next();
    }
  }

  function finishWizard() {
    if (user?.id) {
      localStorage.setItem(`${WIZARD_DONE_KEY}_${user.id}`, "true");
    }
    router.replace("/home");
  }

  // Mark progress in localStorage as each meaningful step completes so a
  // reload doesn't dump the user back at step 1.
  useEffect(() => {
    if (!user?.id) return;
    if (step === "success") {
      localStorage.setItem(`${WIZARD_DONE_KEY}_${user.id}`, "true");
    }
  }, [step, user?.id]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pt-4">
      {/* Progress dots - hide on success step */}
      {step !== "success" && (
        <div className="flex justify-center gap-2">
          {PROGRESS_STEPS.map((s) => {
            const isActive = s === step;
            const isDone = STEP_ORDER.indexOf(s) < STEP_ORDER.indexOf(step);
            return (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  isActive
                    ? "w-8 bg-[var(--color-primary)]"
                    : isDone
                      ? "w-2 bg-[var(--color-primary)]"
                      : "w-2 bg-[var(--color-border)]"
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          {step === "business_type" && (
            <StepCard
              eyebrow="Step 1 of 5"
              title="What kind of work do you do?"
              description="Pick the closest match - this helps Orbit show you the right tools."
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((type) => {
                  const Icon = BUSINESS_TYPE_ICONS[type];
                  const isActive = businessType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setBusinessType(type)}
                      className={`flex flex-col items-center gap-2 px-4 py-5 rounded-[var(--radius-xl)] border-2 transition-all ${
                        isActive
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                          : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/30"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isActive ? "text-[var(--color-primary)]" : "text-[var(--color-ink-light)]"
                        }`}
                      />
                      <span
                        className={`text-small font-semibold text-center ${
                          isActive ? "text-[var(--color-primary-dark)]" : "text-[var(--color-ink)]"
                        }`}
                      >
                        {BUSINESS_TYPE_LABELS[type]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <FooterButtons>
                <Button onClick={persistBusinessType} loading={saving}>
                  Continue
                </Button>
              </FooterButtons>
            </StepCard>
          )}

          {step === "services" && (
            <StepCard
              eyebrow="Step 2 of 5"
              title="What services do you offer?"
              description="We've pre-filled the most common ones for your business. Tweak prices and durations, add anything missing, or remove rows you don't offer."
              icon={<Scissors className="h-6 w-6 text-[var(--color-primary)]" />}
            >
              <div className="space-y-3">
                {services.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_auto] gap-3 items-end px-4 py-3.5 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]"
                  >
                    <Input
                      label={i === 0 ? "Service" : undefined}
                      placeholder="e.g. Full bridal makeup"
                      value={s.name}
                      onChange={(e) => updateService(i, { name: e.target.value })}
                    />
                    <Input
                      label={i === 0 ? "Mins" : undefined}
                      type="number"
                      min={0}
                      value={s.duration_minutes}
                      onChange={(e) =>
                        updateService(i, { duration_minutes: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                    <Input
                      label={i === 0 ? "Price" : undefined}
                      placeholder="$80"
                      value={s.price}
                      onChange={(e) => updateService(i, { price: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeService(i)}
                      className="h-11 w-11 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/30 transition-colors flex items-center justify-center self-end"
                      aria-label="Remove service"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addService}
                  className="inline-flex items-center gap-1.5 text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add another service
                </button>

                <p className="mt-1 text-tiny text-[var(--color-muted)]">
                  Don&apos;t worry about being exact. You can edit anytime from the Services tab.
                </p>
              </div>

              <FooterButtons>
                <button
                  onClick={back}
                  className="text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
                >
                  Back
                </button>
                <Button onClick={persistServices} loading={saving}>
                  {services.some((s) => s.name.trim()) ? "Save & continue" : "Skip for now"}
                </Button>
              </FooterButtons>
            </StepCard>
          )}

          {step === "currency" && (
            <StepCard
              eyebrow="Step 3 of 5"
              title="Where do you do business?"
              description="We'll use this to set your default currency. Change it later from Profile."
              icon={<Globe className="h-6 w-6 text-[var(--color-primary)]" />}
            >
              <div className="max-h-[360px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] divide-y divide-[var(--color-border)] bg-white">
                {COUNTRIES.map((c) => {
                  const isActive = country.code === c.code;
                  return (
                    <button
                      key={c.code}
                      onClick={() => handlePickCountry(c)}
                      className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors ${
                        isActive ? "bg-[var(--color-primary-subtle)]" : "hover:bg-[var(--color-canvas)]"
                      }`}
                    >
                      <span className="text-2xl flex-shrink-0">{c.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-body font-semibold truncate">{c.name}</div>
                        <div className="text-small text-[var(--color-muted)]">
                          {c.currency} · {c.symbol}
                        </div>
                      </div>
                      {isActive && <Check className="h-5 w-5 text-[var(--color-primary)] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <FooterButtons>
                <button onClick={back} className="text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]">
                  Back
                </button>
                <Button onClick={next}>Continue</Button>
              </FooterButtons>
            </StepCard>
          )}

          {step === "client" && (
            <StepCard
              eyebrow="Step 4 of 5"
              title="Add your first client"
              description="Get a feel for the app by adding someone you work with. You can skip this and add clients later."
              icon={<UserPlus className="h-6 w-6 text-[var(--color-primary)]" />}
            >
              <div className="space-y-4">
                <Input
                  label="Full name"
                  placeholder="e.g. Amaka Johnson"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  autoFocus
                />
                <Input
                  label="Phone"
                  placeholder="e.g. +234 901 234 5678"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>

              <FooterButtons>
                <button onClick={() => setStep("booking")} className="text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]">
                  Skip for now
                </button>
                <Button
                  onClick={handleAddClient}
                  loading={saving}
                  disabled={!clientName.trim() || !clientPhone.trim()}
                >
                  Add &amp; continue
                </Button>
              </FooterButtons>
            </StepCard>
          )}

          {step === "booking" && (
            <StepCard
              eyebrow="Step 5 of 5"
              title={createdClientId ? `Book your first session with ${createdClientName}` : "Schedule your first session"}
              description={createdClientId
                ? "Get a sense of how Orbit tracks your appointments."
                : "You can add bookings any time from the Work tab."}
              icon={<Calendar className="h-6 w-6 text-[var(--color-primary)]" />}
            >
              {createdClientId ? (
                <div className="space-y-4">
                  <Input
                    label="Service"
                    placeholder="e.g. Hair appointment, Tutoring session"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    autoFocus
                  />
                  <Input
                    label="Date"
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>
              ) : (
                <div className="px-6 py-8 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] text-center">
                  <Calendar className="h-10 w-10 text-[var(--color-muted)] mx-auto mb-3" />
                  <p className="text-body text-[var(--color-ink-light)] max-w-sm mx-auto">
                    Skip ahead - you can schedule bookings from the Work tab once you&apos;ve added a few clients.
                  </p>
                </div>
              )}

              <FooterButtons>
                <button onClick={() => next()} className="text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]">
                  Skip for now
                </button>
                {createdClientId ? (
                  <Button onClick={handleAddBooking} loading={saving} disabled={!service.trim()}>
                    Schedule &amp; continue
                  </Button>
                ) : (
                  <Button onClick={next}>Continue</Button>
                )}
              </FooterButtons>
            </StepCard>
          )}

          {step === "success" && (
            <SuccessStep onFinish={finishWizard} businessTypeLabel={BUSINESS_TYPE_LABELS[businessType]} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StepCard({
  eyebrow, title, description, icon, children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 sm:p-10">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center mb-5">
          {icon}
        </div>
      )}
      <div className="text-tiny font-bold uppercase tracking-wider text-[var(--color-primary)] mb-2">
        {eyebrow}
      </div>
      <h1 className="text-section font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-body text-[var(--color-ink-light)] leading-relaxed">{description}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function FooterButtons({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-7 pt-6 border-t border-[var(--color-border)] flex items-center justify-between gap-3">
      {children}
    </div>
  );
}

function SuccessStep({ onFinish, businessTypeLabel }: { onFinish: () => void; businessTypeLabel: string }) {
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowParticles(true), 200);
    return () => clearTimeout(t);
  }, []);

  const colors = ["#E8557A", "#22C55E", "#6C63FF", "#F59E0B", "#06B6D4"];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-10 sm:p-14 text-center">
      <div className="relative w-28 h-28 mx-auto mb-7">
        {/* Particles */}
        {showParticles &&
          angles.map((a, i) => {
            const rad = (a * Math.PI) / 180;
            return (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colors[i % colors.length] }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{
                  x: Math.cos(rad) * 64,
                  y: Math.sin(rad) * 64,
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 0.9, delay: i * 0.05, ease: "easeOut" }}
              />
            );
          })}
        <motion.div
          className="relative w-28 h-28 rounded-full bg-[var(--color-success)] flex items-center justify-center mx-auto"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
        >
          <Check className="h-12 w-12 text-white" strokeWidth={3.5} />
        </motion.div>
      </div>

      <h1 className="text-section font-bold tracking-tight">Your workspace is ready 🎉</h1>
      <p className="mt-3 text-lead text-[var(--color-ink-light)] max-w-md mx-auto leading-relaxed">
        You&apos;re all set as a <strong className="text-[var(--color-ink)]">{businessTypeLabel}</strong>.
        Now let&apos;s grow your business.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button size="lg" onClick={onFinish} leftIcon={<Sparkles className="h-4 w-4" />}>
          Enter Orbit
        </Button>
      </div>
    </div>
  );
}
