/**
 * Builds a client-ready invoice PDF entirely in the browser with pdf-lib -
 * no server, no paid service. Uses the business's Branding (name, logo,
 * accent colour, footer) when set.
 *
 * Amounts are written with the ISO currency code ("NGN 3,188.00") rather
 * than the symbol: the built-in PDF fonts can't draw symbols like ₦, and
 * the code is the standard on formal invoices anyway.
 */

import {
  PDFDocument, PDFName, PDFString, StandardFonts, rgb,
  type PDFFont, type PDFImage, type PDFPage, type RGB,
} from "pdf-lib";
import type { Branding } from "@/lib/branding";
import type { Client, Payment } from "@/types";

export interface InvoicePdfInput {
  payment: Payment;
  client: Pick<Client, "name" | "email" | "phone"> | null;
  business: { name: string; ownerName?: string | null; email?: string | null };
  branding: Branding;
  currencyCode: string;
  locale: string;
}

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // page margin
const INK = rgb(0.1, 0.1, 0.1);
const MID = rgb(0.32, 0.32, 0.32);
const MUTED = rgb(0.55, 0.54, 0.52);
const LINE = rgb(0.9, 0.89, 0.87);
const CANVAS = rgb(0.965, 0.96, 0.95);

const STATUS_LABEL: Record<Payment["status"], string> = {
  paid: "PAID", pending: "DUE", overdue: "OVERDUE", partial: "PART PAID", failed: "UNPAID", refunded: "REFUNDED",
};
const TYPE_LABEL: Record<Payment["type"], string> = {
  full: "Payment", deposit: "Deposit", partial: "Part payment", retainer: "Retainer",
};

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { payment, client, business, branding, currencyCode, locale } = input;
  const doc = await PDFDocument.create();
  let page = doc.addPage([A4.w, A4.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(branding.accent_color) ?? rgb(0.91, 0.33, 0.48);

  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n: number) => `${currencyCode} ${nf.format(n)}`;
  const date = (s: string) =>
    new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s)
      .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const businessName = clean(branding.business_name || business.name || business.ownerName || "Invoice", font);
  const invoiceNo = payment.invoice_number ?? `INV-${payment.id.slice(0, 6).toUpperCase()}`;

  doc.setTitle(`Invoice ${invoiceNo}`);
  doc.setAuthor(businessName);
  doc.setCreator("Orbit");

  // ── Accent bar ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: accent });

  // ── Header: business (left), INVOICE + number (right) ─────────────────────
  let y = A4.h - M - 8;
  let textX = M;
  const logo = await tryEmbedLogo(doc, branding.logo_url);
  if (logo) {
    // Fit inside 120 x 44pt, keeping the logo's proportions.
    const ratio = logo.width / logo.height;
    const w = Math.min(120, ratio * 44);
    const h = w / ratio;
    page.drawImage(logo, { x: M, y: y + 12 - h, width: w, height: h });
    textX = M + w + 12;
  }
  page.drawText(businessName, { x: textX, y, size: 17, font: bold, color: INK });
  let by = y - 16;
  for (const line of [branding.tagline, business.email].filter(Boolean) as string[]) {
    page.drawText(clean(line, font), { x: textX, y: by, size: 9.5, font, color: MUTED });
    by -= 13;
  }

  rightText(page, "INVOICE", A4.w - M, y + 2, 24, bold, accent);
  rightText(page, invoiceNo, A4.w - M, y - 18, 10, font, MID);
  // Status pill
  const status = STATUS_LABEL[payment.status];
  const pillW = bold.widthOfTextAtSize(status, 8) + 16;
  const pillColor = payment.status === "paid" ? rgb(0.13, 0.55, 0.3) : payment.status === "overdue" ? rgb(0.75, 0.15, 0.15) : MID;
  page.drawRectangle({ x: A4.w - M - pillW, y: y - 42, width: pillW, height: 16, color: pillColor, opacity: 0.12, borderColor: pillColor, borderWidth: 0.6, borderOpacity: 0.5 });
  page.drawText(status, { x: A4.w - M - pillW + 8, y: y - 37, size: 8, font: bold, color: pillColor });

  // ── Bill to / dates ───────────────────────────────────────────────────────
  y = Math.min(by, y - 50) - 28;
  page.drawLine({ start: { x: M, y: y + 14 }, end: { x: A4.w - M, y: y + 14 }, thickness: 0.6, color: LINE });

  label(page, "BILL TO", M, y, bold);
  let cy = y - 15;
  page.drawText(clean(client?.name ?? payment.client_name, font), { x: M, y: cy, size: 11, font: bold, color: INK });
  for (const line of [client?.email, client?.phone].filter(Boolean) as string[]) {
    cy -= 13;
    page.drawText(clean(line, font), { x: M, y: cy, size: 9.5, font, color: MID });
  }

  const col2 = M + 250, col3 = M + 375;
  label(page, "ISSUED", col2, y, bold);
  page.drawText(date(payment.created_at), { x: col2, y: y - 15, size: 10.5, font, color: INK });
  label(page, payment.status === "paid" ? "PAID ON" : "DUE", col3, y, bold);
  page.drawText(
    payment.status === "paid" && payment.payment_completed_at ? date(payment.payment_completed_at) : date(payment.date),
    { x: col3, y: y - 15, size: 10.5, font, color: INK },
  );

  // ── Line items ────────────────────────────────────────────────────────────
  y = cy - 34;
  const tableW = A4.w - 2 * M;
  page.drawRectangle({ x: M, y: y - 6, width: tableW, height: 22, color: CANVAS });
  label(page, "DESCRIPTION", M + 10, y + 1, bold);
  rightText(page, "AMOUNT", A4.w - M - 10, y + 1, 8, bold, MUTED);
  y -= 26;

  const items = (payment.line_items ?? []).filter((i) => i.description?.trim() || i.amount);
  const rows = items.length
    ? items.map((i) => ({ desc: i.description || "Item", amount: i.amount }))
    : [{ desc: TYPE_LABEL[payment.type] ?? "Payment", amount: payment.amount }];

  for (const row of rows) {
    // Long invoices continue on a new page, repeating the column headings.
    if (y < 150) {
      page = doc.addPage([A4.w, A4.h]);
      page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: accent });
      y = A4.h - M - 10;
      page.drawRectangle({ x: M, y: y - 6, width: tableW, height: 22, color: CANVAS });
      label(page, "DESCRIPTION (CONTINUED)", M + 10, y + 1, bold);
      rightText(page, "AMOUNT", A4.w - M - 10, y + 1, 8, bold, MUTED);
      y -= 26;
    }
    const lines = wrap(clean(row.desc, font), font, 10.5, tableW - 150);
    lines.forEach((l, i) => page.drawText(l, { x: M + 10, y: y - i * 14, size: 10.5, font, color: INK }));
    rightText(page, money(row.amount), A4.w - M - 10, y, 10.5, font, INK);
    y -= lines.length * 14 + 10;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: A4.w - M, y: y + 4 }, thickness: 0.5, color: LINE });
    y -= 10;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  if (y < 260) { page = doc.addPage([A4.w, A4.h]); y = A4.h - M - 10; }
  const paid = payment.status === "paid" ? payment.paid_amount ?? payment.amount : payment.paid_amount ?? 0;
  const balance = payment.status === "paid" ? 0 : payment.remaining_balance ?? Math.max(0, payment.amount - paid);
  const tx = A4.w - M - 200;
  y -= 4;
  totalRow(page, "Total", money(payment.amount), tx, y, font, bold, false);
  if (paid > 0) { y -= 18; totalRow(page, "Paid", `- ${money(paid)}`, tx, y, font, bold, false); }
  y -= 26;
  page.drawRectangle({ x: tx - 10, y: y - 9, width: 210, height: 28, color: accent, opacity: 0.1 });
  totalRow(page, "Balance due", money(balance), tx, y, bold, bold, true, accent);

  // ── Pay online ────────────────────────────────────────────────────────────
  y -= 50;
  if (payment.payment_link && payment.status !== "paid") {
    label(page, "PAY ONLINE", M, y, bold);
    y -= 16;
    page.drawText("Pay securely by card, bank transfer or USSD:", { x: M, y, size: 10, font, color: MID });
    y -= 15;
    const link = payment.payment_link;
    const shown = truncateToWidth(link, font, 10, tableW);
    page.drawText(shown, { x: M, y, size: 10, font, color: accent });
    addLink(doc, page, link, M, y - 3, font.widthOfTextAtSize(shown, 10), 14);
    y -= 30;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (payment.notes?.trim()) {
    label(page, "NOTES", M, y, bold);
    y -= 16;
    for (const l of wrap(clean(payment.notes, font), font, 10, tableW).slice(0, 10)) {
      if (y < 90) break; // keep clear of the footer
      page.drawText(l, { x: M, y, size: 10, font, color: MID });
      y -= 14;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = clean(branding.invoice_footer || "", font);
  if (footer) centerText(page, truncateToWidth(footer, font, 10, tableW), 64, 10, font, MID);
  centerText(page, `${invoiceNo} · ${businessName}`, 44, 8, font, MUTED);

  return doc.save();
}

/** Triggers a browser download of the PDF. */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Opens the phone's share sheet with the PDF attached. Returns false if unsupported. */
export async function sharePdf(bytes: Uint8Array, filename: string, text: string): Promise<boolean> {
  const file = new File([bytes as BlobPart], filename, { type: "application/pdf" });
  if (typeof navigator === "undefined" || !navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: filename.replace(/\.pdf$/, ""), text });
  } catch (err) {
    // User closing the share sheet isn't an error.
    if ((err as Error)?.name !== "AbortError") throw err;
  }
  return true;
}

export function invoiceFilename(payment: Payment): string {
  const no = payment.invoice_number ?? payment.id.slice(0, 6);
  const who = payment.client_name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "");
  return `Invoice-${no}${who ? `-${who}` : ""}.pdf`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Standard PDF fonts only cover Latin-1-ish characters; anything else
 * (emoji, ₦, non-Latin scripts) would make pdf-lib throw. Swap the common
 * ones for readable equivalents and drop the rest.
 */
const charCache = new Map<string, boolean>();
function clean(text: string, font: PDFFont): string {
  const swapped = text.replace(/₦/g, "NGN ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\r?\n/g, " ");
  let out = "";
  for (const ch of swapped) {
    let ok = charCache.get(ch);
    if (ok === undefined) {
      try { font.encodeText(ch); ok = true; } catch { ok = false; }
      charCache.set(ch, ok);
    }
    if (ok) out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
    else { if (line) lines.push(line); line = truncateToWidth(w, font, size, maxW); }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxW) t = t.slice(0, -1);
  return `${t}...`;
}

function label(page: PDFPage, text: string, x: number, y: number, bold: PDFFont) {
  page.drawText(text, { x, y, size: 8, font: bold, color: MUTED });
}

function rightText(page: PDFPage, text: string, right: number, y: number, size: number, font: PDFFont, color: RGB) {
  page.drawText(text, { x: right - font.widthOfTextAtSize(text, size), y, size, font, color });
}

function centerText(page: PDFPage, text: string, y: number, size: number, font: PDFFont, color: RGB) {
  page.drawText(text, { x: (A4.w - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
}

function totalRow(
  page: PDFPage, name: string, value: string, x: number, y: number,
  labelFont: PDFFont, valueFont: PDFFont, big: boolean, color: RGB = INK,
) {
  const size = big ? 12 : 10.5;
  page.drawText(name, { x, y, size, font: labelFont, color: big ? color : MID });
  rightText(page, value, x + 190, y, size, valueFont, color);
}

function addLink(doc: PDFDocument, page: PDFPage, url: string, x: number, y: number, w: number, h: number) {
  const annot = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + w, y + h],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    }),
  );
  page.node.set(PDFName.of("Annots"), doc.context.obj([annot]));
}

/** Logo from the Branding page. Any failure (CORS, bad URL, unsupported type) just means no logo. */
async function tryEmbedLogo(doc: PDFDocument, url: string): Promise<PDFImage | null> {
  if (!url?.trim()) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
  } catch {
    // ignore
  }
  return null;
}
