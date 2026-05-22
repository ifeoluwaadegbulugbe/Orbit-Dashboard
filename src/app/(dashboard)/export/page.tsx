"use client";

import { Download, Users, Receipt, Calendar, Bell, FileSpreadsheet, Check } from "lucide-react";
import { useState } from "react";
import { ProGate } from "@/components/paywall/ProGate";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useBookings } from "@/hooks/useBookings";
import { useReminders } from "@/hooks/useReminders";

type Kind = "clients" | "payments" | "bookings" | "reminders";

export default function ExportPage() {
  return (
    <ProGate
      title="Export Data"
      description="Download every client, invoice, booking and reminder as CSV - opens in Excel, Google Sheets or Numbers."
    >
      <ExportInner />
    </ProGate>
  );
}

function ExportInner() {
  const { data: clients = [] } = useClients();
  const { data: payments = [] } = usePayments();
  const { data: bookings = [] } = useBookings();
  const { data: reminders = [] } = useReminders();
  const [downloading, setDownloading] = useState<Kind | null>(null);
  const [recentlyDownloaded, setRecentlyDownloaded] = useState<Kind | null>(null);

  async function handleDownload(kind: Kind) {
    setDownloading(kind);
    try {
      const res = await fetch(`/api/export/${kind}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbit-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setRecentlyDownloaded(kind);
      setTimeout(() => setRecentlyDownloaded(null), 2500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not download.");
    } finally {
      setDownloading(null);
    }
  }

  const exports: Array<{ kind: Kind; icon: React.ReactNode; label: string; count: number; description: string }> = [
    {
      kind: "clients",
      icon: <Users className="h-5 w-5 text-[var(--color-primary)]" />,
      label: "Clients",
      count: clients.length,
      description: "Names, contact details, status, notes, and balances.",
    },
    {
      kind: "payments",
      icon: <Receipt className="h-5 w-5 text-[var(--color-info)]" />,
      label: "Invoices & payments",
      count: payments.length,
      description: "Every invoice with amount, status, dates, and references.",
    },
    {
      kind: "bookings",
      icon: <Calendar className="h-5 w-5 text-[var(--color-success-deep)]" />,
      label: "Bookings",
      count: bookings.length,
      description: "All sessions and appointments with status and service.",
    },
    {
      kind: "reminders",
      icon: <Bell className="h-5 w-5 text-[var(--color-warning-deep)]" />,
      label: "Reminders",
      count: reminders.length,
      description: "Tasks and follow-ups with due dates and completion status.",
    },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-page font-bold">Export data</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          Your data is always yours. Download anything as CSV.
        </p>
      </div>

      <div className="space-y-3">
        {exports.map((e) => (
          <div
            key={e.kind}
            className="flex items-center gap-5 px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--color-canvas)] flex items-center justify-center flex-shrink-0">
              {e.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body font-semibold">
                {e.label} <span className="text-[var(--color-muted)] font-normal">· {e.count}</span>
              </div>
              <div className="text-small text-[var(--color-ink-light)] mt-0.5">{e.description}</div>
            </div>
            <button
              onClick={() => handleDownload(e.kind)}
              disabled={downloading === e.kind || e.count === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-small font-semibold border border-[var(--color-border)] bg-white hover:bg-[var(--color-canvas)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recentlyDownloaded === e.kind ? (
                <>
                  <Check className="h-4 w-4 text-[var(--color-success)]" /> Downloaded
                </>
              ) : downloading === e.kind ? (
                <>
                  <FileSpreadsheet className="h-4 w-4 animate-pulse" /> Preparing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> CSV
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-primary-subtle)] text-small text-[var(--color-ink-mid)] leading-relaxed">
        <strong className="font-semibold text-[var(--color-ink)]">Tip:</strong>{" "}
        CSV files open in Excel, Google Sheets or Numbers. Use them for backups, accounting,
        or moving your data to another tool.
      </div>
    </div>
  );
}
