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
import { normalizeHandle } from "@/lib/social";
import { InstagramIcon, TikTokIcon } from "@/components/ui/SocialIcons";

interface FormValues {
  name: string;
  phone: string;
  email: string;
  instagram: string;
  tiktok: string;
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
        instagram: client.instagram ? `@${client.instagram}` : "",
        tiktok: client.tiktok ? `@${client.tiktok}` : "",
        status: client.status,
        birthday: client.birthday ?? "",
        notes: client.notes ?? "",
      });
    }
  }, [client, reset]);

  async function onSubmit(values: FormValues) {
    const instagram = normalizeHandle(values.instagram, "instagram");
    const tiktok = normalizeHandle(values.tiktok, "tiktok");
    if (values.instagram.trim() && !instagram) return setError("That Instagram username doesn't look right. Use just the name, like @amaka.glam.");
    if (values.tiktok.trim() && !tiktok) return setError("That TikTok username doesn't look right. Use just the name, like @amaka.glam.");
    setError(null);
    const phone = values.phone.trim();
    try {
      await updateClient.mutateAsync({
        id,
        patch: {
          name: values.name.trim(),
          phone,
          // WhatsApp uses whatsapp_number first, so keep it in step with the phone.
          whatsapp_number: phone,
          email: values.email.trim() || null,
          // Left out when empty and never set, so saving works before migration 028.
          ...(instagram || client?.instagram ? { instagram } : {}),
          ...(tiktok || client?.tiktok ? { tiktok } : {}),
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

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-8 space-y-6">
        <Input label="Full name" icon={<User className="h-4 w-4" />} {...register("name", { required: true })} />
        <Input label="Phone"     icon={<Phone className="h-4 w-4" />} placeholder="Optional" {...register("phone")} />
        <Input label="Email"     type="email" icon={<Mail className="h-4 w-4" />} {...register("email")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input label="Instagram" icon={<InstagramIcon className="h-4 w-4" />} placeholder="@username" autoCapitalize="none" autoCorrect="off" {...register("instagram")} />
          <Input label="TikTok"    icon={<TikTokIcon className="h-4 w-4" />}    placeholder="@username" autoCapitalize="none" autoCorrect="off" {...register("tiktok")} />
        </div>
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
