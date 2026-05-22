"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ChevronLeft, User, Phone, Mail, Cake, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useCreateClient, useClients } from "@/hooks/useClients";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuthStore } from "@/stores/authStore";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import { FREE_CLIENT_LIMIT } from "@/lib/constants";
import type { ClientStatus } from "@/types";

interface FormValues {
  name: string;
  phone: string;
  email: string;
  status: ClientStatus;
  birthday: string;
  notes: string;
}

export default function NewClientPage() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { data: clients = [] } = useClients();
  const { isPro } = useSubscription();
  const createClient = useCreateClient();
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const atLimit = !isPro && clients.length >= FREE_CLIENT_LIMIT;

  const { register, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { status: "active" },
  });

  async function onSubmit(values: FormValues) {
    if (atLimit) {
      setPaywallOpen(true);
      return;
    }
    if (!profile) {
      setError("Your profile isn't loaded yet. Try again in a moment.");
      return;
    }
    setError(null);
    try {
      const phone = values.phone.trim();
      const newClient = await createClient.mutateAsync({
        name: values.name.trim(),
        phone,
        whatsapp_number: phone,         // Default WhatsApp to the same number
        email: values.email.trim() || null,
        status: values.status,
        birthday: values.birthday || null,
        notes: values.notes.trim() || null,
        preferences: null,
        business_type: profile.business_type,
        last_contacted: new Date().toISOString(),
      });
      router.push(`/clients/${newClient.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save client.");
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
      >
        <ChevronLeft className="h-4 w-4" /> All clients
      </Link>

      <div>
        <h1 className="text-page font-bold">New client</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          Add someone you work with. You can fill in more details later.
        </p>
      </div>

      {atLimit && (
        <button
          type="button"
          onClick={() => setPaywallOpen(true)}
          className="w-full flex items-center gap-3 px-5 py-4 bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/25 rounded-[var(--radius-xl)] text-left transition-all hover:shadow-soft"
        >
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
            <Lock className="h-4 w-4 text-[var(--color-primary)]" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">You&apos;ve reached your client limit</div>
            <div className="text-xs text-[var(--color-ink-mid)] mt-0.5">
              Upgrade to Pro for unlimited clients and automations.
            </div>
          </div>
        </button>
      )}

      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 space-y-6">
        <Input
          label="Full name"
          icon={<User className="h-4 w-4" />}
          placeholder="e.g. Amaka Johnson"
          autoComplete="name"
          {...register("name", { required: true })}
        />
        <Input
          label="Phone"
          icon={<Phone className="h-4 w-4" />}
          placeholder="e.g. +234 901 234 5678"
          autoComplete="tel"
          {...register("phone", { required: true })}
        />
        <Input
          label="Email (optional)"
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="amaka@example.com"
          autoComplete="email"
          {...register("email")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Select label="Status" {...register("status")}>
            <option value="active">Active</option>
            <option value="follow_up">Follow up</option>
            <option value="overdue">Overdue</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Input
            label="Birthday (optional)"
            type="date"
            icon={<Cake className="h-4 w-4" />}
            {...register("birthday")}
          />
        </div>
        <Textarea
          label="Notes (optional)"
          placeholder="Preferences, history, anything you'd want to remember..."
          {...register("notes")}
        />

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={formState.isSubmitting} disabled={atLimit}>
            Add client
          </Button>
        </div>
      </form>

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        reason="You've hit the 10-client limit"
      />
    </div>
  );
}
