"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/components/ui/Dialog";
import { useCreateBooking } from "@/hooks/useBookings";
import { useAuthStore } from "@/stores/authStore";
import { useClients } from "@/hooks/useClients";
import { useCreatePayment } from "@/hooks/usePayments";
import { useServices } from "@/hooks/useServices";
import { computeServiceAmount } from "@/lib/services/price";
import { toast } from "@/stores/toastStore";

interface BookingFormValues {
  clientId: string;
  title: string;
  date: string;
  time: string;
  notes: string;
  durationMinutes: number | null;
}

/**
 * Shared between the Bookings tab and Work's Projects tab - a "new project"
 * is a new booking under the hood, since Projects are synthesized from
 * bookings rather than a separate table.
 */
export function NewBookingDialog({
  open, onClose, presetClientId,
}: { open: boolean; onClose: () => void; presetClientId: string }) {
  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();
  const profile = useAuthStore((s) => s.profile);
  const create = useCreateBooking();
  const createPayment = useCreatePayment();
  const [error, setError] = useState<string | null>(null);

  const tomorrow = new Date(Date.now() + 86400000);
  const { register, handleSubmit, reset, formState, setValue, watch } = useForm<BookingFormValues>({
    defaultValues: {
      clientId: presetClientId,
      date: tomorrow.toISOString().slice(0, 10),
      time: "10:00",
      durationMinutes: null,
    },
  });
  const watchedTitle = watch("title");

  useEffect(() => {
    if (presetClientId) reset((prev) => ({ ...prev, clientId: presetClientId }));
  }, [presetClientId, reset]);

  async function onSubmit(values: BookingFormValues) {
    setError(null);
    const client = clients.find((c) => c.id === values.clientId);
    if (!client) {
      setError("Pick a client first.");
      return;
    }
    if (!profile) {
      setError("Your profile isn't loaded yet. Try again in a moment.");
      return;
    }
    try {
      const title = values.title.trim();
      const booking = await create.mutateAsync({
        client_id: client.id,
        client_name: client.name,
        title,
        date: values.date,
        time: values.time,
        status: "confirmed",
        notes: values.notes.trim() || null,
        business_type: profile.business_type,
        duration_minutes: values.durationMinutes,
      });

      // Dashboard bookings are already "confirmed" the moment they're
      // saved, so try to invoice right away - quietly skips if the title
      // doesn't cleanly resolve to a priced service (freehand title, "From
      // N5,000"-style price, etc). See computeServiceAmount.
      const amount = computeServiceAmount(services, title);
      if (amount !== null) {
        try {
          const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
          await createPayment.mutateAsync({
            client_id: client.id,
            client_name: client.name,
            amount,
            paid_amount: null,
            remaining_balance: amount,
            type: "full",
            status: "pending",
            date: values.date,
            notes: null,
            invoice_number: invoiceNumber,
            line_items: null,
            payment_link: null,
            transaction_reference: null,
            payment_provider: null,
            webhook_verified: null,
            payment_completed_at: null,
            booking_id: booking.id,
          });
          toast(`Booking saved. Invoice ${invoiceNumber} created.`, "success");
        } catch {
          // Booking itself already saved - a failed invoice attempt shouldn't
          // block the flow or confuse the owner with an error here.
        }
      }

      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save booking.");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New booking">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-md bg-[var(--color-danger-light)] text-xs text-[var(--color-danger-deep)]">
            {error}
          </div>
        )}

        <Select label="Client" {...register("clientId", { required: true })}>
          <option value="">- Pick a client -</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        {/* Service quick-pick. When the owner has services configured, show
            them as chips above the Title field - tapping fills the title
            instead of typing it manually. */}
        {services.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-small font-semibold text-[var(--color-ink)]">
                Service
              </label>
              <Link
                href="/services"
                className="text-tiny font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-primary)]"
              >
                Edit list
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {services.map((s, i) => {
                const isSelected = watchedTitle === s.name;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setValue("title", s.name, { shouldValidate: true });
                      setValue("durationMinutes", s.duration_minutes ?? null);
                    }}
                    className={`px-3.5 py-2 rounded-full border text-small font-semibold transition-colors ${
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]"
                        : "border-[var(--color-border)] bg-white text-[var(--color-ink-light)] hover:border-[var(--color-primary)]/40"
                    }`}
                  >
                    {s.name || "Untitled"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Link
            href="/services"
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-primary-subtle)]/60 hover:bg-[var(--color-primary-subtle)] transition-colors"
          >
            <div className="text-small">
              <div className="font-semibold text-[var(--color-ink)]">Add services to pick from</div>
              <div className="text-tiny text-[var(--color-ink-light)] mt-0.5">
                Build your menu once, use it everywhere.
              </div>
            </div>
          </Link>
        )}

        <Input
          label={services.length > 0 ? "Or type a custom title" : "Title"}
          placeholder="e.g. Hair appointment, Tutoring session"
          {...register("title", { required: true })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date"
            type="date"
            {...register("date", { required: true })}
          />
          <Input
            label="Time"
            type="time"
            {...register("time", { required: true })}
          />
        </div>

        <Textarea label="Notes (optional)" {...register("notes")} />

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting}>Add booking</Button>
        </div>
      </form>
    </Dialog>
  );
}
