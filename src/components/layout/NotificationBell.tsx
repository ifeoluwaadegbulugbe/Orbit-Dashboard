"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell, Calendar, DollarSign, AlertCircle, Sparkles, Cake, Heart,
  Check, X, Database, Zap, type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useNotificationsResult,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from "@/hooks/useNotifications";
import { toast } from "@/stores/toastStore";
import type { NotificationType, NotificationRow } from "@/types";
import { relativeDate } from "@/lib/utils";

interface TypeMeta {
  icon: LucideIcon;
  bg: string;
  fg: string;
}

const TYPE_META: Record<NotificationType, TypeMeta> = {
  booking_received:      { icon: Calendar,    bg: "var(--color-info-light)",    fg: "var(--color-info)" },
  booking_confirmed:     { icon: Check,       bg: "var(--color-success-light)", fg: "var(--color-success-deep)" },
  booking_cancelled:     { icon: X,           bg: "var(--color-danger-light)",  fg: "var(--color-danger-deep)" },
  payment_received:      { icon: DollarSign,  bg: "var(--color-success-light)", fg: "var(--color-success-deep)" },
  invoice_overdue:       { icon: AlertCircle, bg: "var(--color-danger-light)",  fg: "var(--color-danger-deep)" },
  reminder_due:          { icon: Bell,        bg: "var(--color-warning-light)", fg: "var(--color-warning-deep)" },
  trial_ending:          { icon: Sparkles,    bg: "var(--color-primary-subtle)", fg: "var(--color-primary)" },
  trial_expired:         { icon: Sparkles,    bg: "var(--color-warning-light)", fg: "var(--color-warning-deep)" },
  subscription_renewed:  { icon: Heart,       bg: "var(--color-success-light)", fg: "var(--color-success-deep)" },
  subscription_failed:   { icon: AlertCircle, bg: "var(--color-danger-light)",  fg: "var(--color-danger-deep)" },
  client_birthday:       { icon: Cake,        bg: "var(--color-primary-subtle)", fg: "var(--color-primary)" },
  welcome:               { icon: Sparkles,    bg: "var(--color-primary-subtle)", fg: "var(--color-primary)" },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useNotificationsResult();
  const notifications = data?.rows ?? [];
  const setupNeeded = data?.setupNeeded ?? false;
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  async function handleSendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };
      if (!res.ok || !json.ok) {
        if (json.code === "TABLE_MISSING") {
          toast(
            "Run supabase/migrations/002_notifications.sql in Supabase SQL Editor first.",
            "danger",
          );
        } else {
          toast(json.error ?? "Test failed", "danger");
        }
        return;
      }
      toast("Test notifications fired. Refreshing the bell...", "success");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Test failed", "danger");
    } finally {
      setTesting(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleNotificationClick(n: NotificationRow) {
    if (!n.is_read) markRead.mutate(n.id);
    setOpen(false);
    // Navigation happens via the wrapping <Link> if action_url is set
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-[var(--color-border-light)] transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="h-5 w-5 text-[var(--color-ink-mid)]" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--color-primary)] text-white text-[9px] font-bold leading-none flex items-center justify-center ring-[1.5px] ring-white">
            +{unread > 9 ? 9 : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-[92vw] sm:w-[380px] max-h-[480px] rounded-[var(--radius-2xl)] bg-white border border-[var(--color-border)] shadow-soft-lg overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
              <h3 className="text-card-title font-semibold">Notifications</h3>
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-5 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-14 rounded-[var(--radius-md)] skeleton" />
                  ))}
                </div>
              ) : setupNeeded ? (
                <SetupNeededState onTest={handleSendTest} testing={testing} />
              ) : notifications.length === 0 ? (
                <EmptyState onTest={handleSendTest} testing={testing} />
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {notifications.map((n) => (
                    <NotificationRowItem
                      key={n.id}
                      notification={n}
                      onClick={() => handleNotificationClick(n)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationRowItem({
  notification, onClick,
}: { notification: NotificationRow; onClick: () => void }) {
  const meta = TYPE_META[notification.type] ?? TYPE_META.welcome;
  const Icon = meta.icon;

  const content = (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 px-5 py-4 transition-colors cursor-pointer ${
        notification.is_read ? "hover:bg-[var(--color-canvas)]" : "bg-[var(--color-primary-subtle)]/40 hover:bg-[var(--color-primary-subtle)]/70"
      }`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: meta.bg }}
      >
        <Icon className="h-4 w-4" style={{ color: meta.fg }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-small font-semibold text-[var(--color-ink)] leading-snug">
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] flex-shrink-0 mt-1.5" />
          )}
        </div>
        {notification.body && (
          <p className="text-small text-[var(--color-ink-light)] mt-0.5 leading-snug line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-tiny text-[var(--color-muted)] mt-1">
          {relativeDate(notification.created_at)}
        </p>
      </div>
    </div>
  );

  if (notification.action_url) {
    return (
      <Link href={notification.action_url} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

// ─── Empty + setup states ──────────────────────────────────────────────────

function EmptyState({ onTest, testing }: { onTest: () => void; testing: boolean }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-canvas)] mx-auto mb-3 flex items-center justify-center">
        <Check className="h-5 w-5 text-[var(--color-success)]" />
      </div>
      <p className="text-body font-semibold text-[var(--color-ink)]">All caught up</p>
      <p className="text-small text-[var(--color-muted)] mt-1 leading-relaxed">
        New bookings, payments and alerts will land here.
      </p>
      <button
        onClick={onTest}
        disabled={testing}
        className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-tiny font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors disabled:opacity-50"
      >
        <Zap className="h-3 w-3" />
        {testing ? "Sending..." : "Send test notification"}
      </button>
    </div>
  );
}

function SetupNeededState({ onTest, testing }: { onTest: () => void; testing: boolean }) {
  return (
    <div className="px-6 py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-warning-light)] mx-auto mb-3 flex items-center justify-center">
        <Database className="h-5 w-5 text-[var(--color-warning-deep)]" />
      </div>
      <p className="text-body font-semibold text-[var(--color-ink)]">One-time setup needed</p>
      <p className="text-small text-[var(--color-muted)] mt-1 leading-relaxed">
        The notifications table doesn&apos;t exist in your database yet. Open Supabase &rarr;
        SQL Editor and paste in
        <code className="block mt-2 px-2 py-1 rounded bg-[var(--color-canvas)] text-tiny font-mono text-[var(--color-ink-mid)] break-all">
          supabase/migrations/002_notifications.sql
        </code>
      </p>
      <button
        onClick={onTest}
        disabled={testing}
        className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-tiny font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors disabled:opacity-50"
      >
        <Zap className="h-3 w-3" />
        {testing ? "Checking..." : "Test once setup is done"}
      </button>
    </div>
  );
}
