"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Bell, Plus, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import {
  useReminders,
  useCreateReminder,
  useToggleReminder,
  useDeleteReminder,
} from "@/hooks/useReminders";
import { useClients } from "@/hooks/useClients";
import { formatShortDate, relativeDate } from "@/lib/utils";

interface FormValues {
  message: string;
  dueDate: string;
  clientId: string;
}

export default function RemindersPage() {
  return (
    <Suspense fallback={<div className="h-40 rounded-[var(--radius-xl)] skeleton" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const search = useSearchParams();
  const presetClientId = search.get("clientId") ?? "";
  const [dialogOpen, setDialogOpen] = useState(search.get("new") === "1");
  const { data: reminders = [], isLoading } = useReminders();
  const { data: clients = [] } = useClients();
  const create = useCreateReminder();
  const toggle = useToggleReminder();
  const del = useDeleteReminder();

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: {
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      clientId: presetClientId,
    },
  });

  useEffect(() => {
    if (presetClientId) reset((prev) => ({ ...prev, clientId: presetClientId }));
  }, [presetClientId, reset]);

  async function onSubmit(values: FormValues) {
    const client = clients.find((c) => c.id === values.clientId);
    await create.mutateAsync({
      message: values.message.trim(),
      due_date: values.dueDate,
      client_id: client?.id ?? null,
      client_name: client?.name ?? null,
      repeat_type: "never",
    });
    reset({ message: "", dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), clientId: "" });
    setDialogOpen(false);
  }

  const pending = reminders.filter((r) => !r.is_done);
  const done = reminders.filter((r) => r.is_done);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page font-bold">Reminders</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">Never miss a follow-up.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setDialogOpen(true)}>
          New reminder
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-[var(--radius-xl)] skeleton" />)}
        </div>
      ) : reminders.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
          <Bell className="h-10 w-10 text-[var(--color-muted)] mx-auto mb-3" />
          <h3 className="text-base font-bold mb-1">No reminders yet</h3>
          <p className="text-sm text-[var(--color-ink-light)] max-w-sm mx-auto">
            Add reminders to follow up on outstanding invoices, check in with quiet clients, or celebrate birthdays.
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <Section title="Upcoming">
              {pending.map((r) => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  onToggle={() => toggle.mutate({ id: r.id, isDone: true })}
                  onDelete={() => del.mutate(r.id)}
                />
              ))}
            </Section>
          )}
          {done.length > 0 && (
            <Section title={`Done · ${done.length}`}>
              {done.map((r) => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  onToggle={() => toggle.mutate({ id: r.id, isDone: false })}
                  onDelete={() => del.mutate(r.id)}
                />
              ))}
            </Section>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="New reminder">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="What's the reminder?"
            placeholder="e.g. Follow up on Sarah's invoice"
            {...register("message", { required: true })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Due date" type="date" {...register("dueDate", { required: true })} />
            <Select label="Client (optional)" {...register("clientId")}>
              <option value="">- None -</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" loading={formState.isSubmitting}>Add reminder</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</h3>
      </div>
      <div className="divide-y divide-[var(--color-border)]">{children}</div>
    </div>
  );
}

function ReminderRow({
  reminder, onToggle, onDelete,
}: {
  reminder: { id: string; message: string; due_date: string; is_done: boolean; client_name: string | null };
  onToggle: () => void;
  onDelete: () => void;
}) {
  const overdue = !reminder.is_done && new Date(reminder.due_date).getTime() < Date.now();
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 ${reminder.is_done ? "opacity-60" : ""}`}>
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          reminder.is_done
            ? "bg-[var(--color-success)] border-[var(--color-success)]"
            : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
        }`}
      >
        {reminder.is_done && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold text-[var(--color-ink)] ${reminder.is_done ? "line-through" : ""}`}>
          {reminder.message}
        </div>
        <div className="text-xs text-[var(--color-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{formatShortDate(reminder.due_date)} · {relativeDate(reminder.due_date)}</span>
          {reminder.client_name && <span>· {reminder.client_name}</span>}
          {overdue && <Badge tone="danger">Overdue</Badge>}
        </div>
      </div>
      <button onClick={onDelete} className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/30 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
