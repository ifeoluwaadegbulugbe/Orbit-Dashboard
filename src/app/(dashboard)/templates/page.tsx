"use client";

import { useState, useEffect } from "react";
import { Plus, Copy, Check, Trash2, MessageSquare, Edit2 } from "lucide-react";
import { ProGate } from "@/components/paywall/ProGate";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";

const TEMPLATES_STORAGE_KEY = "orbit_templates_v1";

type TemplateKind = "follow_up" | "payment_reminder" | "thank_you" | "booking_confirmation" | "custom";

interface Template {
  id: string;
  kind: TemplateKind;
  title: string;
  body: string;
}

const KIND_LABEL: Record<TemplateKind, string> = {
  follow_up: "Follow-up",
  payment_reminder: "Payment reminder",
  thank_you: "Thank you",
  booking_confirmation: "Booking confirmation",
  custom: "Custom",
};

const KIND_TONE: Record<TemplateKind, "primary" | "warning" | "success" | "info" | "neutral"> = {
  follow_up: "warning",
  payment_reminder: "info",
  thank_you: "success",
  booking_confirmation: "primary",
  custom: "neutral",
};

const STARTERS: Template[] = [
  {
    id: "starter-followup",
    kind: "follow_up",
    title: "Gentle check-in",
    body: "Hi {name} 👋 Just checking in - it's been a little while. Hope all is well! If you're thinking of booking again, I'd love to hear from you.",
  },
  {
    id: "starter-reminder",
    kind: "payment_reminder",
    title: "Friendly payment nudge",
    body: "Hi {name}! Just a quick reminder that invoice {invoice} for {amount} is still outstanding. No stress - let me know if you need a fresh payment link.",
  },
  {
    id: "starter-thanks",
    kind: "thank_you",
    title: "Thank you + referral",
    body: "Thank you so much, {name}! It's clients like you that make this work a joy. If you ever know someone who'd love what I do, I'd love to meet them.",
  },
  {
    id: "starter-booking",
    kind: "booking_confirmation",
    title: "Booking confirmation",
    body: "You're all set, {name}! Your appointment is confirmed for {date}. I'll send a reminder the day before. Can't wait!",
  },
];

export default function TemplatesPage() {
  return (
    <ProGate
      title="Message Templates"
      description="Save your best message scripts once, send them in seconds. Follow-ups, payment reminders, thank-you notes - never start from scratch."
    >
      <TemplatesInner />
    </ProGate>
  );
}

function TemplatesInner() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (raw) {
      try {
        setTemplates(JSON.parse(raw));
      } catch {
        setTemplates(STARTERS);
      }
    } else {
      setTemplates(STARTERS);
    }
    setLoaded(true);
  }, []);

  function persist(next: Template[]) {
    setTemplates(next);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
  }

  function handleNew() {
    setEditing({ id: "", kind: "custom", title: "", body: "" });
    setDialogOpen(true);
  }

  function handleEdit(t: Template) {
    setEditing(t);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    persist(templates.filter((t) => t.id !== id));
  }

  function handleSave(t: Template) {
    if (!t.title.trim() || !t.body.trim()) return;
    if (t.id) {
      persist(templates.map((x) => (x.id === t.id ? t : x)));
    } else {
      persist([...templates, { ...t, id: `tmpl-${Date.now()}` }]);
    }
    setDialogOpen(false);
    setEditing(null);
  }

  async function handleCopy(t: Template) {
    await navigator.clipboard.writeText(t.body);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page font-bold">Templates</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">
            Pre-written messages, ready to send.
          </p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={handleNew}>
          New template
        </Button>
      </div>

      {!loaded ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-[var(--radius-2xl)] skeleton" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] p-10 text-center">
          <MessageSquare className="h-10 w-10 text-[var(--color-muted)] mx-auto mb-3" />
          <h3 className="text-card-title font-semibold mb-2">No templates yet</h3>
          <p className="text-body text-[var(--color-ink-light)] max-w-sm mx-auto">
            Save your most-sent messages once and pull them up in seconds.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="text-card-title font-semibold truncate">{t.title}</div>
                  <Badge tone={KIND_TONE[t.kind]} className="mt-1.5">
                    {KIND_LABEL[t.kind]}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(t)}
                    className="p-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-border-light)] transition-colors"
                    aria-label="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/30 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-body text-[var(--color-ink-mid)] leading-relaxed flex-1 whitespace-pre-wrap">
                {t.body}
              </p>
              <button
                onClick={() => handleCopy(t)}
                className="mt-5 self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-semibold border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-colors"
              >
                {copiedId === t.id ? (
                  <><Check className="h-3.5 w-3.5 text-[var(--color-success)]" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Copy message</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-primary-subtle)] text-small text-[var(--color-ink-mid)] leading-relaxed">
        <strong className="font-semibold text-[var(--color-ink)]">Tip:</strong>{" "}
        Use placeholders like <code className="px-1 py-0.5 bg-white rounded text-tiny font-mono">{"{name}"}</code>,{" "}
        <code className="px-1 py-0.5 bg-white rounded text-tiny font-mono">{"{amount}"}</code> or{" "}
        <code className="px-1 py-0.5 bg-white rounded text-tiny font-mono">{"{date}"}</code> - they'll be replaced when you send.
      </div>

      <TemplateEditor
        open={dialogOpen}
        template={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}

function TemplateEditor({
  open, template, onClose, onSave,
}: {
  open: boolean;
  template: Template | null;
  onClose: () => void;
  onSave: (t: Template) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<TemplateKind>("custom");

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setBody(template.body);
      setKind(template.kind);
    }
  }, [template]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!template) return;
    onSave({ ...template, title: title.trim(), body: body.trim(), kind });
  }

  return (
    <Dialog open={open} onClose={onClose} title={template?.id ? "Edit template" : "New template"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          placeholder="e.g. Gentle follow-up"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div>
          <label className="block text-small font-semibold mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_LABEL) as TemplateKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-3.5 py-1.5 rounded-full text-tiny font-semibold border transition-colors ${
                  kind === k
                    ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary-dark)]"
                    : "bg-white border-[var(--color-border)] text-[var(--color-ink-light)] hover:border-[var(--color-primary)]/40"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          label="Message"
          placeholder="What you'd like to say. Use {name}, {amount}, {date} as placeholders."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          required
        />

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save template</Button>
        </div>
      </form>
    </Dialog>
  );
}
