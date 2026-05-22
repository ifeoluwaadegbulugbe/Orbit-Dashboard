"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, CheckCircle2, Trash2, Receipt, Calendar, User, MessageCircle,
  Link2, Copy, Check, ExternalLink, Loader2, Sparkles,
} from "lucide-react";
import { usePayment, useUpdatePayment, useDeletePayment } from "@/hooks/usePayments";
import { useClient } from "@/hooks/useClients";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatShortDate, relativeDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import { useConnectedProvider, buildProviderKeysForRequest } from "@/hooks/useConnectedProvider";
import { PROVIDER_INFO } from "@/lib/payment-providers";
import type { PaymentStatus } from "@/types";

const TONE: Record<PaymentStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  paid: "success", pending: "warning", overdue: "danger",
  partial: "info", failed: "danger", refunded: "neutral",
};

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const qc = useQueryClient();
  const { data: payment, isLoading } = usePayment(id);
  const { data: client } = useClient(payment?.client_id);
  const { format: formatCurrency } = useCurrency();
  const { provider: connectedProvider, hydrated: providerHydrated } = useConnectedProvider();
  const update = useUpdatePayment();
  const del = useDeletePayment();
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const justPaid = search.get("paid") === "success";

  if (isLoading) return <div className="h-40 rounded-[var(--radius-xl)] skeleton" />;
  if (!payment) {
    return (
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
        <p className="text-body text-[var(--color-ink-light)]">Invoice not found.</p>
        <Link href="/payments" className="inline-block mt-3 text-small font-semibold text-[var(--color-primary)]">
          Back to invoices
        </Link>
      </div>
    );
  }

  async function markPaid() {
    if (!payment) return;
    setBusy(true);
    await update.mutateAsync({
      id: payment.id,
      patch: {
        status: "paid",
        paid_amount: payment.amount,
        remaining_balance: 0,
        payment_completed_at: new Date().toISOString(),
      },
    });
    setBusy(false);
  }

  async function handleDelete() {
    if (!payment) return;
    if (!confirm("Delete this invoice?")) return;
    await del.mutateAsync(payment.id);
    router.replace("/payments");
  }

  async function handleGenerateLink() {
    if (!payment) return;
    if (!connectedProvider) {
      setLinkError("Connect a payment provider first in Online Payments.");
      return;
    }
    const keys = buildProviderKeysForRequest(connectedProvider);
    if (!keys) {
      setLinkError(
        "Your saved keys are incomplete. Open Online Payments and finish filling them in.",
      );
      return;
    }
    setLinkError(null);
    setLinking(true);
    try {
      const res = await fetch(`/api/payments/${payment.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: connectedProvider, keys }),
      });
      const text = await res.text();
      let json: { payment_link?: string; error?: string } = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        // Non-JSON response (HTML error page, etc.) - fall through to the !res.ok branch
      }
      if (!res.ok) throw new Error(json.error ?? `Could not generate link (${res.status})`);
      qc.invalidateQueries({ queryKey: ["payments"] });
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Could not generate link");
    } finally {
      setLinking(false);
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const whatsappReminderUrl = client
    ? `https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hi ${client.name}, this is a friendly reminder for invoice ${payment.invoice_number ?? ""} (${formatCurrency(payment.amount)}).`,
      )}`
    : "#";

  const paymentLinkMessage = client && payment.payment_link
    ? `Hi ${client.name}! Here's your invoice ${payment.invoice_number ? `(${payment.invoice_number}) ` : ""}for ${formatCurrency(payment.amount)}. You can pay securely here: ${payment.payment_link}`
    : "";

  const whatsappPayUrl = client && payment.payment_link
    ? `https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(paymentLinkMessage)}`
    : "#";

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/payments" className="inline-flex items-center gap-1 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]">
        <ChevronLeft className="h-4 w-4" /> All invoices
      </Link>

      {/* Success banner after a successful customer payment redirect */}
      {justPaid && (
        <div className="px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-success-light)] text-[var(--color-success-deep)] flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span className="text-body font-semibold">
            Payment received! This invoice will be marked paid shortly.
          </span>
        </div>
      )}

      {/* Hero */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {payment.invoice_number ?? "Invoice"}
            </div>
            <div className="mt-1 text-stat font-extrabold tracking-tight">{formatCurrency(payment.amount)}</div>
            <div className="mt-3">
              <Badge tone={TONE[payment.status]}>{payment.status}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            {payment.status !== "paid" && (
              <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={markPaid} loading={busy}>
                Mark paid
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-[var(--color-danger)]">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-7 pt-5 border-t border-[var(--color-border)] grid grid-cols-2 gap-5">
          <Meta icon={<Calendar className="h-3.5 w-3.5" />} label="Date" value={formatShortDate(payment.date)} sub={relativeDate(payment.date)} />
          <Meta icon={<Receipt className="h-3.5 w-3.5" />} label="Type" value={payment.type} />
        </div>
      </div>

      {/* Client card */}
      {client && (
        <Link
          href={`/clients/${client.id}`}
          className="flex items-center gap-4 px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm hover:shadow-soft transition-all"
        >
          <Avatar name={client.name} size={48} />
          <div className="flex-1 min-w-0">
            <div className="text-body font-semibold truncate">{client.name}</div>
            <div className="text-small text-[var(--color-muted)] mt-0.5">{client.phone}</div>
          </div>
          <User className="h-4 w-4 text-[var(--color-muted)]" />
        </Link>
      )}

      {/* ── Payment link section ── */}
      {payment.status !== "paid" && (
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
          <div className="px-7 pt-6 pb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                <Link2 className="h-5 w-5 text-[var(--color-primary)]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-card-title font-semibold">Get paid online</h3>
                <p className="text-small text-[var(--color-ink-light)] mt-0.5">
                  Send your client a secure payment link - they pay by card, bank transfer or USSD.
                </p>
              </div>
            </div>
            {/* Connected-provider chip */}
            {connectedProvider && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-tiny font-semibold flex-shrink-0"
                style={{
                  backgroundColor: `${PROVIDER_INFO[connectedProvider].color}14`,
                  color: PROVIDER_INFO[connectedProvider].color,
                }}
              >
                Via {PROVIDER_INFO[connectedProvider].name}
              </span>
            )}
          </div>

          <div className="px-7 pb-7">
            {linkError && (
              <div className="mb-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-small text-[var(--color-danger-deep)] leading-relaxed">
                {linkError}
                {/* If the error mentions a provider not being configured, surface a one-click fix */}
                {(linkError.toLowerCase().includes("not configured") ||
                  linkError.toLowerCase().includes("isn't set up") ||
                  linkError.toLowerCase().includes("rejected the api key")) && (
                  <div className="mt-3">
                    <Link
                      href="/payment-settings"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[var(--color-primary)] text-tiny font-semibold border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary-subtle)] transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      Open setup guide
                    </Link>
                  </div>
                )}
              </div>
            )}

            {payment.payment_link ? (
              <div className="space-y-4">
                {/* The link itself */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]">
                  <Link2 className="h-4 w-4 text-[var(--color-muted)] flex-shrink-0" />
                  <span className="flex-1 text-small font-mono text-[var(--color-ink-mid)] truncate">
                    {payment.payment_link}
                  </span>
                </div>

                {/* Share actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleCopy(payment.payment_link!)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-white border border-[var(--color-border)] text-small font-semibold hover:border-[var(--color-primary)]/40 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-[var(--color-success)]" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy link
                      </>
                    )}
                  </button>

                  {client && (
                    <a
                      href={whatsappPayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-small font-semibold hover:opacity-90 transition-opacity"
                    >
                      <MessageCircle className="h-4 w-4" /> Send via WhatsApp
                    </a>
                  )}

                  <a
                    href={payment.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[var(--color-primary)] text-white text-small font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" /> Preview
                  </a>
                </div>

                {payment.transaction_reference && (
                  <p className="text-tiny text-[var(--color-muted)] mt-2">
                    Reference · {payment.transaction_reference}
                  </p>
                )}

                <button
                  onClick={handleGenerateLink}
                  disabled={linking}
                  className="text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
                >
                  {linking ? "Regenerating…" : "Regenerate link"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {providerHydrated && !connectedProvider ? (
                  // ── No provider connected - show CTA to connect first ──
                  <div className="space-y-4">
                    <p className="text-small text-[var(--color-ink-light)] leading-relaxed">
                      You haven&apos;t connected a payment provider yet. Pick one of{" "}
                      <strong className="text-[var(--color-ink)]">Paystack, Stripe</strong> or{" "}
                      <strong className="text-[var(--color-ink)]">Flutterwave</strong> in Online Payments - Orbit will
                      use it to generate the link.
                    </p>
                    <Link
                      href="/payment-settings"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-primary)] text-white text-small font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
                    >
                      <Sparkles className="h-4 w-4" />
                      Connect a payment provider
                    </Link>
                  </div>
                ) : (
                  // ── Provider connected - ready to generate ──
                  <>
                    <p className="text-small text-[var(--color-ink-light)] leading-relaxed">
                      Generate a one-time payment link via{" "}
                      <strong className="text-[var(--color-ink)]">
                        {connectedProvider ? PROVIDER_INFO[connectedProvider].name : "your connected provider"}
                      </strong>
                      . Your client pays instantly - the invoice updates here once payment clears.
                    </p>
                    {!client?.email && (
                      <p className="text-small text-[var(--color-warning-deep)] bg-[var(--color-warning-light)] px-4 py-3 rounded-[var(--radius-md)]">
                        💡 This client doesn&apos;t have an email saved.{" "}
                        <Link href={`/clients/${client?.id}/edit`} className="font-semibold underline">
                          Add one
                        </Link>{" "}
                        so receipts go to the right place.
                      </p>
                    )}
                    <Button
                      onClick={handleGenerateLink}
                      loading={linking}
                      leftIcon={<Sparkles className="h-4 w-4" />}
                      size="lg"
                      disabled={!connectedProvider}
                    >
                      Generate payment link
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reminder action */}
      {client && payment.status !== "paid" && !payment.payment_link && (
        <a
          href={whatsappReminderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[var(--color-border)] text-[var(--color-ink)] rounded-full text-small font-semibold hover:bg-[var(--color-canvas)] transition-colors"
        >
          <MessageCircle className="h-4 w-4 text-[var(--color-success-deep)]" /> Send WhatsApp reminder (no link)
        </a>
      )}

      {/* Notes */}
      {payment.notes && (
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7">
          <h3 className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">Notes</h3>
          <p className="text-body whitespace-pre-wrap text-[var(--color-ink-mid)] leading-relaxed">{payment.notes}</p>
        </div>
      )}

    </div>
  );
}

function Meta({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {icon} {label}
      </div>
      <div className="mt-1 text-body font-semibold capitalize">{value}</div>
      {sub && <div className="text-small text-[var(--color-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}
