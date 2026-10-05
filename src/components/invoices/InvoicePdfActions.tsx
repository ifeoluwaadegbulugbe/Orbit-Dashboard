"use client";

import { useEffect, useState } from "react";
import { Download, Share2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import { loadBranding } from "@/lib/branding";
import { toast } from "@/stores/toastStore";
import type { Client, Payment } from "@/types";

/**
 * "Download PDF" (everywhere) and "Share PDF" (phones / browsers that can
 * attach files to the share sheet - WhatsApp, Mail, etc.) for one invoice.
 * The PDF library is loaded only when a button is pressed.
 */
export function InvoicePdfActions({ payment, client }: { payment: Payment; client: Client | null | undefined }) {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const { code, country } = useCurrency();
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    try {
      const probe = new File([new Uint8Array([0])], "probe.pdf", { type: "application/pdf" });
      setCanShareFiles(!!navigator.canShare?.({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  async function build() {
    const { buildInvoicePdf, invoiceFilename } = await import("@/lib/invoices/pdf");
    const bytes = await buildInvoicePdf({
      payment,
      client: client ?? null,
      business: {
        name: profile?.business_name ?? "",
        ownerName: profile?.full_name,
        email: profile?.email ?? user?.email,
      },
      branding: loadBranding(),
      currencyCode: code,
      locale: country.locale,
    });
    return { bytes, filename: invoiceFilename(payment) };
  }

  async function handleDownload() {
    setBusy("download");
    try {
      const { bytes, filename } = await build();
      const { downloadPdf } = await import("@/lib/invoices/pdf");
      downloadPdf(bytes, filename);
    } catch (err) {
      console.error("[invoice-pdf]", err);
      toast("Couldn't create the PDF. Please try again.", "danger");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy("share");
    try {
      const { bytes, filename } = await build();
      const { sharePdf, downloadPdf } = await import("@/lib/invoices/pdf");
      const text = payment.payment_link && payment.status !== "paid"
        ? `Here's your invoice. You can pay securely here: ${payment.payment_link}`
        : "Here's your invoice.";
      const shared = await sharePdf(bytes, filename, text);
      if (!shared) downloadPdf(bytes, filename);
    } catch (err) {
      console.error("[invoice-pdf]", err);
      toast("Couldn't share the PDF. Try Download instead.", "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={canShareFiles ? "grid grid-cols-2 gap-3" : "grid grid-cols-1"}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy !== null}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-white border border-[var(--color-border)] text-small font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)]/40 transition-colors disabled:opacity-60"
      >
        {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download PDF
      </button>
      {canShareFiles && (
        <button
          type="button"
          onClick={handleShare}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[var(--color-ink)] text-white text-small font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Share PDF
        </button>
      )}
    </div>
  );
}
