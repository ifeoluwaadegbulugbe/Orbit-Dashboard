"use client";

import { useState } from "react";
import { Calendar, Clock, User, Mail, Phone, MessageSquare, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

interface Service {
  name: string;
  duration_minutes: number;
  price: string;
}

interface PublicBookingFormProps {
  slug: string;
  businessName: string;
  services: Service[];
}

export function PublicBookingForm({ slug, businessName, services }: PublicBookingFormProps) {
  const [selectedService, setSelectedService] = useState<number>(0);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setError("Please add your name and at least one way to reach you (phone or email)");
      return;
    }
    if (services.length === 0) {
      setError("This business hasn't added any services yet. Reach out directly.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const service = services[selectedService];
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          service: service?.name,
          date,
          time,
          customer: {
            name: name.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
          },
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send your booking");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your booking");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-[var(--color-success)] mx-auto mb-5 flex items-center justify-center">
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </div>
        <h2 className="text-section font-bold tracking-tight mb-3">
          Booking request sent
        </h2>
        <p className="text-body text-[var(--color-ink-light)] leading-relaxed max-w-md mx-auto">
          {businessName} will confirm by WhatsApp or email soon. Keep an eye on your messages.
        </p>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-small text-[var(--color-danger-deep)] leading-relaxed">
          {error}
        </div>
      )}

      {/* Service picker */}
      {services.length > 0 && (
        <div>
          <label className="block text-small font-semibold text-[var(--color-ink)] mb-2">
            Pick a service
          </label>
          <div className="space-y-2">
            {services.map((s, i) => {
              const isSelected = selectedService === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedService(i)}
                  className={`w-full flex items-center justify-between gap-4 px-5 py-4 rounded-[var(--radius-lg)] border-2 transition-all text-left ${
                    isSelected
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                      : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/30"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-body font-semibold text-[var(--color-ink)] truncate">
                      {s.name || "Untitled service"}
                    </div>
                    <div className="text-small text-[var(--color-muted)] mt-0.5">
                      {s.duration_minutes ? `${s.duration_minutes} min` : "Duration TBC"}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-body font-bold text-[var(--color-ink)]">
                      {s.price || "Price TBC"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Date + time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Preferred date"
          type="date"
          icon={<Calendar className="h-4 w-4" />}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="Preferred time"
          type="time"
          icon={<Clock className="h-4 w-4" />}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
      </div>

      {/* Customer info */}
      <div className="space-y-4">
        <Input
          label="Your name"
          icon={<User className="h-4 w-4" />}
          placeholder="e.g. Sade Adekunle"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone"
            type="tel"
            icon={<Phone className="h-4 w-4" />}
            placeholder="+234 901 234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            hint="Used for WhatsApp confirmation"
          />
          <Input
            label="Email (optional)"
            type="email"
            icon={<Mail className="h-4 w-4" />}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Textarea
          label="Anything else? (optional)"
          placeholder="Special requests, location, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
      >
        {submitting ? "Sending..." : `Send booking request to ${businessName}`}
      </Button>

      <p className="text-tiny text-center text-[var(--color-muted)]">
        <MessageSquare className="inline h-3 w-3 mr-1" />
        {businessName} will confirm by WhatsApp or email. This is a request, not a guaranteed slot.
      </p>
    </form>
  );
}
