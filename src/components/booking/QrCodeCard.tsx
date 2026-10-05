"use client";

import { useEffect, useState } from "react";
import { Download, QrCode } from "lucide-react";

/**
 * QR code for the booking link - for the shop wall, business cards and
 * flyers. Generated in the browser (qrcode library), downloadable as a
 * high-resolution PNG with the business name underneath.
 */
export function QrCodeCard({ url, businessName }: { url: string; businessName: string }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) { setPreview(null); return; }
    import("qrcode").then((QR) =>
      QR.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: "M", color: { dark: "#1A1A1A", light: "#FFFFFF" } }),
    ).then((d) => { if (!cancelled) setPreview(d); });
    return () => { cancelled = true; };
  }, [url]);

  async function download() {
    const QR = await import("qrcode");
    // Print-quality: 1200px code plus a caption strip.
    const code = document.createElement("canvas");
    await QR.toCanvas(code, url, { margin: 2, width: 1200, errorCorrectionLevel: "M" });
    const out = document.createElement("canvas");
    out.width = 1200;
    out.height = 1200 + 220;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(code, 0, 0);
    ctx.fillStyle = "#1A1A1A";
    ctx.textAlign = "center";
    ctx.font = "bold 64px Inter, Arial, sans-serif";
    ctx.fillText(`Book with ${businessName}`, 600, 1290, 1100);
    ctx.fillStyle = "#6B6B6B";
    ctx.font = "40px Inter, Arial, sans-serif";
    ctx.fillText("Scan with your phone camera", 600, 1370, 1100);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `booking-qr-${businessName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
      <div className="flex items-center gap-3 mb-4">
        <QrCode className="h-5 w-5 text-[var(--color-primary)]" />
        <h3 className="text-card-title font-semibold">QR code</h3>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-36 h-36 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-2 flex items-center justify-center flex-shrink-0 self-center sm:self-auto">
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview} alt="QR code for your booking link" className="w-full h-full" />
          ) : (
            <div className="w-full h-full skeleton rounded" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-small text-[var(--color-ink-light)] leading-relaxed">
            Print it for your shop wall, business cards or flyers. Clients scan it with their
            phone camera and land straight on your booking page.
          </p>
          <button
            type="button"
            onClick={download}
            disabled={!url}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--color-ink)] text-white text-small font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Download for printing
          </button>
        </div>
      </div>
    </div>
  );
}
