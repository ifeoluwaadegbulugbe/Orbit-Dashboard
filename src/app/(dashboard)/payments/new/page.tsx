"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { ChevronLeft, DollarSign, Calendar, FileText, Hash } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useClients } from "@/hooks/useClients";
import { useCreatePayment } from "@/hooks/usePayments";
import type { PaymentStatus } from "@/types";

interface FormValues {
  clientId: string;
  amount: string;
  date: string;
  status: PaymentStatus;
  invoiceNumber: string;
  notes: string;
}

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<div className="h-40 rounded-[var(--radius-xl)] skeleton" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const presetClientId = search.get("clientId") ?? "";
  const { data: clients = [] } = useClients();
  const createPayment = useCreatePayment();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: {
      clientId: presetClientId,
      date: today,
      status: "pending",
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    },
  });

  useEffect(() => {
    if (presetClientId) reset((prev) => ({ ...prev, clientId: presetClientId }));
  }, [presetClientId, reset]);

  async function onSubmit(values: FormValues) {
    setError(null);
    const amount = parseFloat(values.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    const client = clients.find((c) => c.id === values.clientId);
    if (!client) {
      setError("Pick a client for this invoice.");
      return;
    }

    try {
      const payment = await createPayment.mutateAsync({
        client_id: client.id,
        client_name: client.name,
        amount,
        paid_amount: values.status === "paid" ? amount : null,
        remaining_balance: values.status === "paid" ? 0 : amount,
        type: "full",
        status: values.status,
        date: values.date,
        notes: values.notes.trim() || null,
        invoice_number: values.invoiceNumber.trim() || null,
        line_items: null,
        payment_link: null,
        transaction_reference: null,
        payment_provider: null,
        webhook_verified: null,
        payment_completed_at: values.status === "paid" ? new Date().toISOString() : null,
      });
      router.push(`/payments/${payment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save invoice.");
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <Link href="/payments" className="inline-flex items-center gap-1 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]">
        <ChevronLeft className="h-4 w-4" /> All invoices
      </Link>

      <div>
        <h1 className="text-page font-bold">New invoice</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          Log a payment or create an invoice to send.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 space-y-6">
        <Select label="Client" {...register("clientId", { required: true })}>
          <option value="">- Pick a client -</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0"
            icon={<DollarSign className="h-4 w-4" />}
            placeholder="0.00"
            {...register("amount", { required: true })}
          />
          <Input
            label="Date"
            type="date"
            icon={<Calendar className="h-4 w-4" />}
            {...register("date", { required: true })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Select label="Status" {...register("status")}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </Select>
          <Input
            label="Invoice number"
            icon={<Hash className="h-4 w-4" />}
            {...register("invoiceNumber")}
          />
        </div>

        <Textarea
          label="Notes (optional)"
          placeholder="What's this invoice for?"
          {...register("notes")}
        />

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} leftIcon={<FileText className="h-4 w-4" />}>
            Create invoice
          </Button>
        </div>
      </form>
    </div>
  );
}
