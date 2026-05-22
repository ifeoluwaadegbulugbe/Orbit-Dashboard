"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ChevronLeft, User, Phone, Mail, Cake } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useClient, useUpdateClient } from "@/hooks/useClients";
import type { ClientStatus } from "@/types";

interface FormValues {
  name: string;
  phone: string;
  email: string;
  status: ClientStatus;
  birthday: string;
  notes: string;
}

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: client, isLoading } = useClient(id);
  const updateClient = useUpdateClient();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<FormValues>();

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        phone: client.phone,
        email: client.email ?? "",
        status: client.status,
        birthday: client.birthday ?? "",
        notes: client.notes ?? "",
      });
    }
  }, [client, reset]);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await updateClient.mutateAsync({
        id,
        patch: {
          name: values.name.trim(),
          phone: values.phone.trim(),
          email: values.email.trim() || null,
          status: values.status,
          birthday: values.birthday || null,
          notes: values.notes.trim() || null,
        },
      });
      router.push(`/clients/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    }
  }

  if (isLoading) return <div className="h-40 rounded-[var(--radius-xl)] skeleton" />;
  if (!client) return <p className="text-sm text-[var(--color-muted)]">Client not found.</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <Link href={`/clients/${id}`} className="inline-flex items-center gap-1 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]">
        <ChevronLeft className="h-4 w-4" /> Back to {client.name}
      </Link>
      <div>
        <h1 className="text-page font-bold">Edit client</h1>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8 space-y-6">
        <Input label="Full name" icon={<User className="h-4 w-4" />} {...register("name", { required: true })} />
        <Input label="Phone"     icon={<Phone className="h-4 w-4" />} {...register("phone", { required: true })} />
        <Input label="Email"     type="email" icon={<Mail className="h-4 w-4" />} {...register("email")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Select label="Status" {...register("status")}>
            <option value="active">Active</option>
            <option value="follow_up">Follow up</option>
            <option value="overdue">Overdue</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Input label="Birthday" type="date" icon={<Cake className="h-4 w-4" />} {...register("birthday")} />
        </div>
        <Textarea label="Notes" {...register("notes")} />

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting}>Save changes</Button>
        </div>
      </form>
    </div>
  );
}
