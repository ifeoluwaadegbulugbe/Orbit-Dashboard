"use client";

import { useEffect, useState } from "react";
import { Star, Eye, EyeOff, MessageSquareQuote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/stores/toastStore";
import { relativeDate } from "@/lib/utils";

export interface ReviewRow {
  id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  service: string | null;
  is_hidden: boolean;
  created_at: string;
}

/**
 * The owner's reviews, with the option to hide one from the public page.
 * Reviews can't be edited or deleted by the owner - only hidden - so the
 * public rating stays trustworthy.
 */
export function ReviewsManager({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [missingTable, setMissingTable] = useState(false);

  useEffect(() => {
    createClient()
      .from("reviews")
      .select("id, client_name, rating, comment, service, is_hidden, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setMissingTable(true); setReviews([]); return; }
        setReviews((data as ReviewRow[]) ?? []);
      });
  }, [userId]);

  async function toggle(r: ReviewRow) {
    const next = !r.is_hidden;
    setReviews((list) => list?.map((x) => (x.id === r.id ? { ...x, is_hidden: next } : x)) ?? null);
    const { error } = await createClient().from("reviews").update({ is_hidden: next }).eq("id", r.id);
    if (error) {
      toast("Couldn't update that review.", "danger");
      setReviews((list) => list?.map((x) => (x.id === r.id ? { ...x, is_hidden: r.is_hidden } : x)) ?? null);
    }
  }

  const visible = reviews?.filter((r) => !r.is_hidden) ?? [];
  const avg = visible.length ? visible.reduce((a, r) => a + r.rating, 0) / visible.length : null;

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <MessageSquareQuote className="h-5 w-5 text-[var(--color-primary)]" />
          <h3 className="text-card-title font-semibold">Reviews</h3>
        </div>
        {avg !== null && (
          <span className="inline-flex items-center gap-1 text-small font-bold">
            <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" /> {avg.toFixed(1)}
            <span className="font-normal text-[var(--color-muted)]">({visible.length})</span>
          </span>
        )}
      </div>
      <p className="text-small text-[var(--color-muted)] mb-4">
        Ask for a review from any past appointment on the client&apos;s page. Reviews appear on your booking page.
      </p>

      {reviews === null ? (
        <div className="h-20 skeleton rounded-[var(--radius-lg)]" />
      ) : missingTable ? (
        <p className="text-small text-[var(--color-warning-deep)]">Reviews aren&apos;t set up yet - run migration 017 in Supabase.</p>
      ) : reviews.length === 0 ? (
        <p className="text-small text-[var(--color-ink-light)]">No reviews yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {reviews.map((r) => (
            <li key={r.id} className={`py-3.5 flex items-start gap-3 ${r.is_hidden ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Stars rating={r.rating} />
                  <span className="text-small font-semibold">{r.client_name}</span>
                  <span className="text-tiny text-[var(--color-muted)]">{relativeDate(r.created_at)}</span>
                  {r.is_hidden && <span className="text-tiny font-semibold text-[var(--color-muted)]">Hidden</span>}
                </div>
                {r.comment && <p className="mt-1 text-small text-[var(--color-ink-mid)] leading-relaxed">{r.comment}</p>}
              </div>
              <button
                type="button"
                onClick={() => toggle(r)}
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-tiny font-semibold border border-[var(--color-border)] hover:bg-[var(--color-canvas)]"
              >
                {r.is_hidden ? <><Eye className="h-3.5 w-3.5" /> Show</> : <><EyeOff className="h-3.5 w-3.5" /> Hide</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= rating ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[var(--color-border)]"}
        />
      ))}
    </span>
  );
}
