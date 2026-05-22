"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/stores/toastStore";
import { Badge } from "@/components/ui/Badge";
import type { Booking } from "@/types";

interface BookingActionsProps {
  bookingId: string;
  status: Booking["status"];
  clientName?: string;
  /** Tighter footprint for use inside small rows (today's schedule). */
  compact?: boolean;
}

interface RespondResult {
  ok?: boolean;
  status?: "confirmed" | "cancelled";
  emailSent?: boolean;
  emailError?: string | null;
  whatsappUrl?: string | null;
  clientHasEmail?: boolean;
  clientHasPhone?: boolean;
  error?: string;
}

/**
 * Drop in next to any booking row. When the booking is pending, shows
 * inline Confirm / Decline buttons. When it's already resolved, shows a
 * simple status badge.
 *
 * The Confirm/Decline buttons call the server endpoint /api/bookings/[id]/respond
 * which updates the status, emails the client when possible, and returns a
 * wa.me URL the browser can open to send a WhatsApp message in one tap.
 */
export function BookingActions({
  bookingId, status, clientName, compact,
}: BookingActionsProps) {
  const qc = useQueryClient();
  const [isWorking, setWorking] = useState(false);

  async function respond(action: "confirmed" | "cancelled") {
    setWorking(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });

      // Try to parse even on non-OK so we can surface the server message.
      const json = (await res.json().catch(() => ({}))) as RespondResult;
      if (!res.ok) {
        throw new Error(json.error ?? `Could not ${action === "confirmed" ? "confirm" : "decline"} booking`);
      }

      // Bell dropdown, bookings list, client detail all read from cached
      // queries. Invalidate the relevant ones so they show the new status.
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });

      // Open the wa.me link so the owner can hit Send in WhatsApp.
      // (Browsers allow window.open during a user-initiated handler.)
      if (json.whatsappUrl) {
        window.open(json.whatsappUrl, "_blank", "noopener,noreferrer");
      }

      // Compose a toast that tells the owner exactly what happened.
      const who = clientName ? ` ${clientName}` : "";
      if (action === "confirmed") {
        if (json.emailSent && json.whatsappUrl) {
          toast(`Confirmed${who}. Email sent + WhatsApp opened.`, "success");
        } else if (json.emailSent) {
          toast(`Confirmed${who}. Email sent.`, "success");
        } else if (json.whatsappUrl) {
          toast(`Confirmed${who}. Tap Send in WhatsApp.`, "success");
        } else {
          toast(
            `Confirmed${who}. No email or phone on file - reach out manually.`,
            "success",
          );
        }
      } else {
        if (json.emailSent && json.whatsappUrl) {
          toast(`Cancelled${who}. Email sent + WhatsApp opened.`, "success");
        } else if (json.emailSent) {
          toast(`Cancelled${who}. Email sent.`, "success");
        } else if (json.whatsappUrl) {
          toast(`Cancelled${who}. Tap Send in WhatsApp.`, "success");
        } else {
          toast(`Booking cancelled${who}.`, "success");
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "danger");
    } finally {
      setWorking(false);
    }
  }

  function handleConfirm() {
    void respond("confirmed");
  }

  function handleDecline() {
    if (!confirm(
      clientName
        ? `Cancel this booking with ${clientName}?`
        : "Cancel this booking?",
    )) return;
    void respond("cancelled");
  }

  // Already resolved - just show a soft badge so users know
  if (status !== "pending") {
    return (
      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
    );
  }

  // Pending - inline confirm/decline buttons
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleConfirm}
          disabled={isWorking}
          aria-label="Confirm booking"
          className="w-8 h-8 rounded-full bg-[var(--color-success)] hover:bg-[var(--color-success-deep)] disabled:opacity-50 text-white flex items-center justify-center transition-colors"
        >
          {isWorking
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>
        <button
          onClick={handleDecline}
          disabled={isWorking}
          aria-label="Decline booking"
          className="w-8 h-8 rounded-full bg-white border border-[var(--color-border)] hover:border-[var(--color-danger)]/40 hover:bg-[var(--color-danger-light)]/30 disabled:opacity-50 text-[var(--color-ink-light)] hover:text-[var(--color-danger)] flex items-center justify-center transition-colors"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={handleConfirm}
        disabled={isWorking}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-success)] hover:bg-[var(--color-success-deep)] disabled:opacity-50 text-white text-small font-semibold transition-colors"
      >
        {isWorking
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        Confirm
      </button>
      <button
        onClick={handleDecline}
        disabled={isWorking}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-[var(--color-border)] hover:border-[var(--color-danger)]/40 hover:bg-[var(--color-danger-light)]/30 disabled:opacity-50 text-[var(--color-ink-light)] hover:text-[var(--color-danger)] text-small font-semibold transition-colors"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        Decline
      </button>
    </div>
  );
}

const STATUS_TONE: Record<Booking["status"], "success" | "warning" | "danger" | "neutral"> = {
  confirmed: "success",
  pending: "warning",
  cancelled: "danger",
  completed: "neutral",
};

const STATUS_LABEL: Record<Booking["status"], string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  cancelled: "Cancelled",
  completed: "Completed",
};
