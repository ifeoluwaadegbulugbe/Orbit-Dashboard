"use client";

import { useState } from "react";
import { Star, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export function ReviewForm({
  bookingId, token, businessName, firstName, service, date, bookingPageUrl,
}: {
  bookingId: string;
  token: string;
  businessName: string;
  firstName: string;
  service: string;
  date: string;
  bookingPageUrl: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = hover || rating;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setError("Tap a star to rate your appointment."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, token, rating, comment }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't save your review.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your review.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--color-success)] mx-auto mb-4 flex items-center justify-center">
          <Check className="h-7 w-7 text-white" strokeWidth={3} />
        </div>
        <h1 className="text-card-title font-bold">Thank you, {firstName}!</h1>
        <p className="mt-2 text-small text-[var(--color-ink-light)]">Your review is now on {businessName}&apos;s page.</p>
        {bookingPageUrl && (
          <a href={bookingPageUrl} className="mt-5 inline-flex px-5 py-2.5 rounded-full bg-[var(--color-primary)] text-white text-small font-bold">
            Book your next appointment
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-8">
      <h1 className="text-section font-bold tracking-tight">How was your appointment?</h1>
      <p className="mt-2 text-small text-[var(--color-ink-light)]">
        {service} with <b className="text-[var(--color-ink)]">{businessName}</b> · {date}
      </p>

      <div className="mt-6 flex flex-col items-center">
        <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} star${i === 1 ? "" : "s"}`}
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              className="p-1.5 transition-transform active:scale-90"
            >
              <Star className={`h-10 w-10 ${i <= shown ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[var(--color-border)]"}`} />
            </button>
          ))}
        </div>
        <div className="h-5 mt-1 text-small font-semibold text-[var(--color-ink-light)]">{LABELS[shown]}</div>
      </div>

      <div className="mt-5">
        <Textarea
          label="Tell others about it (optional)"
          placeholder="What did you love? Would you recommend them?"
          value={comment}
          maxLength={1000}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {error && <p className="mt-3 text-small text-[var(--color-danger-deep)]">{error}</p>}

      <Button type="submit" size="lg" fullWidth loading={busy} className="mt-5">
        Post review
      </Button>
      <p className="mt-3 text-tiny text-center text-[var(--color-muted)]">
        Shown publicly with your first name and last initial.
      </p>
    </form>
  );
}
