"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles, Send, Loader2, Plus, Trash2, MoreHorizontal,
  PenLine, DollarSign, TrendingUp, Heart, ArrowLeft, Menu, X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ProGate } from "@/components/paywall/ProGate";
import { useAuthStore } from "@/stores/authStore";
import {
  useAiConversations,
  useAiConversation,
  useDeleteAiConversation,
} from "@/hooks/useAiConversations";
import type { AiMessage, AiConversation } from "@/types";

interface PromptSuggestion {
  icon: typeof PenLine;
  iconColor: string;
  title: string;
  prompt: string;
}

const SUGGESTED_PROMPTS: PromptSuggestion[] = [
  {
    icon: PenLine,
    iconColor: "var(--color-info)",
    title: "Follow up softly",
    prompt: "How do I follow up on an overdue invoice without sounding rude?",
  },
  {
    icon: Heart,
    iconColor: "var(--color-primary)",
    title: "Thank a great client",
    prompt: "Help me write a thank-you message for a great client.",
  },
  {
    icon: DollarSign,
    iconColor: "var(--color-success)",
    title: "Raise my prices",
    prompt: "Should I raise my prices? How do I tell my clients?",
  },
  {
    icon: TrendingUp,
    iconColor: "var(--color-warning-deep)",
    title: "Get more bookings",
    prompt: "Give me 3 ways to get more bookings this month.",
  },
];

export default function AIAssistantPage() {
  return (
    <ProGate
      title="AI Assistant"
      description="Get smart, tailored advice for your business - payment follow-ups, pricing, growth tactics and more."
    >
      <AssistantInner />
    </ProGate>
  );
}

function AssistantInner() {
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { data: conversations = [], isLoading: convosLoading } = useAiConversations();
  const { data: activeConvo } = useAiConversation(activeId);
  const deleteConvo = useDeleteAiConversation();

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Lock dashboard scroll so the page reads as a true full-screen takeover
  // (like opening chat.openai.com). Reset on unmount so other pages aren't
  // affected.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Load messages when an old conversation is selected
  useEffect(() => {
    if (activeConvo) setMessages(activeConvo.messages ?? []);
  }, [activeConvo]);

  // Keep chat scrolled to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto-grow the composer textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const grouped = useMemo(() => groupByDate(conversations), [conversations]);

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setMobileSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function openChat(c: AiConversation) {
    setActiveId(c.id);
    setError(null);
    setMobileSidebarOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    try {
      await deleteConvo.mutateAsync(id);
      if (activeId === id) newChat();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const newMessages: AiMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, conversationId: activeId }),
      });
      const json = (await res.json()) as {
        reply?: string;
        conversationId?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "AI request failed");

      setMessages([...newMessages, { role: "assistant", content: json.reply ?? "" }]);
      if (json.conversationId && !activeId) setActiveId(json.conversationId);
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  // ── Sidebar contents (shared between desktop column + mobile drawer) ───
  const sidebarContent = (
    <>
      <div className="p-3 flex-shrink-0 space-y-1.5">
        <Link
          href="/home"
          className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] hover:bg-white/60 text-small text-[var(--color-ink-light)] font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orbit
        </Link>
        <button
          onClick={newChat}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] hover:border-[var(--color-ink-light)] text-[var(--color-ink)] text-small font-semibold transition-colors shadow-soft-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {convosLoading ? (
          <div className="p-2 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-[var(--radius-md)] skeleton" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-tiny text-[var(--color-muted)] leading-relaxed">
              Your chats will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="px-3 mb-1 text-[10px] uppercase tracking-wider font-bold text-[var(--color-muted)]">
                  {group.label}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      isActive={activeId === c.id}
                      onClick={() => openChat(c)}
                      onDelete={() => handleDelete(c.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-[var(--color-primary)]" />
          </div>
          <p className="text-tiny text-[var(--color-ink-light)] font-semibold">
            Orbit Assistant
          </p>
        </div>
      </div>
    </>
  );

  return (
    // Fixed overlay covering the entire viewport so the chat is truly
    // centered on screen, not just within the dashboard's main column.
    // z-50 sits above the dashboard sidebar / topbar.
    <div className="fixed inset-0 z-50 bg-white flex">
      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-[260px] flex-shrink-0 bg-[var(--color-canvas)] border-r border-[var(--color-border)] flex-col">
        {sidebarContent}
      </aside>

      {/* ── Mobile sidebar drawer ─────────────────────────────────────── */}
      {mobileSidebarOpen && (
        <>
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/30 z-10"
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-20 w-[280px] bg-[var(--color-canvas)] border-r border-[var(--color-border)] flex flex-col">
            <div className="flex items-center justify-end p-2 border-b border-[var(--color-border)]">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 rounded-full hover:bg-white/60"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* ── Main chat pane ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-white flex-shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-full hover:bg-[var(--color-canvas)]"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="text-small font-semibold">Assistant</span>
          </div>
          <button
            onClick={newChat}
            className="p-2 rounded-full hover:bg-[var(--color-canvas)]"
            aria-label="New chat"
          >
            <Plus className="h-5 w-5" />
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState firstName={firstName} onPick={send} />
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 lg:px-8 py-8 space-y-6">
              {messages.map((m, i) => (
                <MessageRow key={i} role={m.role} content={m.content} />
              ))}
              {loading && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  </div>
                  <div className="pt-1.5 flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted)] animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted)] animate-pulse" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted)] animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-auto w-full max-w-3xl px-4 lg:px-8 pb-2">
            <div className="px-3 py-2 rounded-md bg-[var(--color-danger-light)] text-small text-[var(--color-danger-deep)]">
              {error}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="flex-shrink-0 px-4 lg:px-8 pb-6 pt-3 bg-white">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="relative flex items-end bg-white border border-[var(--color-border)] rounded-[28px] shadow-soft-md focus-within:border-[var(--color-ink-light)] transition-colors"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything"
                rows={1}
                className="flex-1 resize-none bg-transparent px-5 py-3.5 max-h-[200px] text-body placeholder:text-[var(--color-muted)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="m-2 w-9 h-9 rounded-full bg-[var(--color-ink)] hover:bg-[var(--color-ink-mid)] disabled:bg-[var(--color-border)] disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Send"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </button>
            </form>
            <p className="text-tiny text-[var(--color-muted)] text-center mt-2">
              Orbit Assistant can make mistakes. Double-check important details.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ConversationRow({
  conversation, isActive, onClick, onDelete,
}: {
  conversation: AiConversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function handle() { setMenuOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  return (
    <li
      onClick={onClick}
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] cursor-pointer transition-colors ${
        isActive
          ? "bg-white"
          : "hover:bg-white/60"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-small text-[var(--color-ink)] truncate leading-snug">
          {conversation.title || "New chat"}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--color-border-light)] transition-opacity flex-shrink-0"
        aria-label="More actions"
      >
        <MoreHorizontal className="h-3.5 w-3.5 text-[var(--color-ink-light)]" />
      </button>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-1 top-9 z-10 bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-soft-md py-1 w-32"
        >
          <button
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-small text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/40 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

function EmptyState({ firstName, onPick }: { firstName: string; onPick: (q: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-12">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center mb-5">
        <Sparkles className="h-7 w-7 text-[var(--color-primary)]" />
      </div>
      <h2 className="text-page font-bold text-[var(--color-ink)] mb-3 text-center">
        How can I help, {firstName}?
      </h2>
      <p className="text-body text-[var(--color-ink-light)] max-w-md text-center mb-10 leading-relaxed">
        I&apos;m your business coach. Ask about follow-ups, pricing, marketing,
        or anything else on your mind.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {SUGGESTED_PROMPTS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.title}
              onClick={() => onPick(p.prompt)}
              className="text-left p-4 bg-white hover:bg-[var(--color-canvas)] border border-[var(--color-border)] hover:border-[var(--color-ink-light)] rounded-[var(--radius-xl)] transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${p.iconColor}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: p.iconColor }} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-small font-semibold text-[var(--color-ink)] mb-1">
                    {p.title}
                  </div>
                  <div className="text-tiny text-[var(--color-ink-light)] leading-relaxed line-clamp-2">
                    {p.prompt}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MessageRow({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-[20px] bg-[var(--color-canvas)] text-[var(--color-ink)] text-body whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
      </div>
      <div className="flex-1 min-w-0 text-body text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap pt-0.5">
        {content}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupByDate(items: AiConversation[]): Array<{ label: string; items: AiConversation[] }> {
  const today: AiConversation[] = [];
  const yesterday: AiConversation[] = [];
  const lastWeek: AiConversation[] = [];
  const lastMonth: AiConversation[] = [];
  const older: AiConversation[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const c of items) {
    const t = new Date(c.updated_at).getTime();
    const ageDays = (startOfToday - t) / dayMs;
    if (ageDays < 0) today.push(c);
    else if (ageDays < 1) yesterday.push(c);
    else if (ageDays < 7) lastWeek.push(c);
    else if (ageDays < 30) lastMonth.push(c);
    else older.push(c);
  }

  const groups: Array<{ label: string; items: AiConversation[] }> = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (lastWeek.length) groups.push({ label: "Previous 7 days", items: lastWeek });
  if (lastMonth.length) groups.push({ label: "Previous 30 days", items: lastMonth });
  if (older.length) groups.push({ label: "Older", items: older });
  return groups;
}
