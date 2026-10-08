/**
 * Orbit email design system - block renderer.
 *
 * An email is a list of blocks (statement, UI card, notification stack,
 * before/after, steps, checklist, stat, divider, CTA...). The eight
 * layouts are just different block recipes, so every email belongs to the
 * same family without looking identical.
 *
 * Email-safe by construction: nested tables, inline styles, bgcolor
 * attributes, system fonts, PNG doodles with empty alt (decorative), all
 * information in live text, fluid single column that never needs
 * horizontal scrolling. Works with images off.
 */

import { COLOR as C, FONT, TYPE, WIDTH } from "./tokens";

// ── Content model ──────────────────────────────────────────────────────────

export type UICard =
  | { kind: "payment"; amount: string; client: string; note?: string; status?: string }
  | { kind: "booking"; service: string; client: string; weekday: string; day: string; month: string; time: string; status?: string }
  | { kind: "client"; name: string; detail?: string; facts: { label: string; value: string }[]; tag?: string }
  | { kind: "invoice"; number: string; client: string; lines: { label: string; amount: string }[]; total: string; status?: string }
  | { kind: "reminder"; title: string; due: string; client?: string };

export type Block =
  | { type: "statement"; text: string; size?: "xl" | "lg"; underline?: boolean; align?: "left" | "center" }
  | { type: "text"; paragraphs: string[]; align?: "left" | "center" }
  | { type: "card"; card: UICard; sticker?: string; annotation?: string; cursor?: boolean }
  | { type: "notifications"; items: { icon: "booking" | "payment" | "invoice" | "reminder" | "client"; title: string; meta: string; time: string }[] }
  | { type: "beforeAfter"; before: string[]; after: string[] }
  | { type: "steps"; title: string; items: { title: string; body?: string }[] }
  | { type: "checklist"; title: string; items: { title: string; done: boolean }[] }
  | { type: "stat"; value: string; label: string; progress?: number }
  | { type: "divider" }
  | { type: "cta"; text: string; url: string; secondary?: { text: string; url: string }; align?: "left" | "center" }
  | { type: "signoff"; lines: string[] };

export interface EmailContent {
  /** Inbox preview line. */
  preheader: string;
  /** Small label in the header, e.g. "Setup · 2 of 4". */
  eyebrow?: string;
  /** Used for <title> and the plain-text heading. */
  title: string;
  blocks: Block[];
}

export interface EmailFooter {
  appUrl: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  /** Why they're getting it - shown first in the footer. */
  reason?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** **bold**, and *serif italic accent* (the editorial phrase, in pink). */
function rich(s: string, accent: string = C.pink): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight:700;color:${C.ink};">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<span style="font-family:${FONT.serif};font-style:italic;font-weight:400;color:${accent};letter-spacing:-0.5px;">$1</span>`);
}
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");

const font = (t: readonly [number, number, number, number], family: string = FONT.sans) =>
  `font-family:${family};font-size:${t[0]}px;line-height:${t[1]}px;font-weight:${t[2]};letter-spacing:${t[3]}px;`;

const img = (base: string, name: string, w: number, h: number, extra = "") =>
  `<img src="${esc(base)}/email/${name}.png" width="${w}" height="${h}" alt="" style="display:block;border:0;${extra}">`;

/** A row in the main column with standard side padding. */
const row = (inner: string, pad = "0 40px", cls = "o-pad") =>
  `<tr><td class="${cls}" style="padding:${pad};">${inner}</td></tr>`;

/** Paper card: hairline border + a slightly darker bottom edge for gentle lift (no box-shadow - Gmail drops it). */
function paper(inner: string, opts: { bg?: string; pad?: string; border?: string } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${opts.bg ?? C.paper}" style="background:${opts.bg ?? C.paper};border:1px solid ${opts.border ?? C.mist};border-bottom:3px solid ${C.mistDeep};border-radius:16px;">
    <tr><td style="padding:${opts.pad ?? "20px"};">${inner}</td></tr></table>`;
}

function badge(text: string, tone: "success" | "pink" | "amber" | "neutral" = "success") {
  const [bg, fg] = {
    success: [C.successBg, C.success],
    pink: [C.pinkSoft, C.rose],
    amber: [C.amberBg, C.amber],
    neutral: [C.mist, C.body],
  }[tone];
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${bg};color:${fg};${font(TYPE.meta)}">${esc(text)}</span>`;
}

/** Initials avatar, like the app's. */
function avatar(name: string, size = 40) {
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return `<div style="width:${size}px;height:${size}px;line-height:${size}px;border-radius:999px;background:${C.pinkSoft};color:${C.rose};text-align:center;font-family:${FONT.sans};font-size:${Math.round(size * 0.38)}px;font-weight:700;">${esc(initials)}</div>`;
}

/** Sticker: editorial label stuck to a card corner. Real text. */
const sticker = (text: string) =>
  `<span style="display:inline-block;padding:5px 11px;border:1.5px solid ${C.ink};border-radius:999px;background:${C.pinkSoft};color:${C.ink};font-family:${FONT.sans};font-size:12px;font-weight:800;letter-spacing:0.2px;">${esc(text)}</span>`;

const ICON_GLYPH: Record<string, string> = { booking: "&#9711;", payment: "&#8358;", invoice: "&#9636;", reminder: "&#9201;", client: "&#9679;" };

// ── UI cards (fragments of the real product) ────────────────────────────────

function uiCard(c: UICard, base: string, cursor: boolean): string {
  const label = (t: string) => `<div style="${font(TYPE.eyebrow)}text-transform:uppercase;color:${C.meta};">${esc(t)}</div>`;
  const cursorImg = cursor ? `<td valign="bottom" style="padding-left:6px;">${img(base, "cursor", 22, 26)}</td>` : "";
  switch (c.kind) {
    case "payment":
      return paper(`
        ${label("Payment received")}
        <div style="margin-top:10px;${font(TYPE.amount)}color:${C.ink};">${esc(c.amount)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr>
          <td width="44" valign="middle">${avatar(c.client, 36)}</td>
          <td valign="middle" style="${font(TYPE.small)}color:${C.softBlack};"><strong>${esc(c.client)}</strong>${c.note ? `<br><span style="color:${C.meta};">${esc(c.note)}</span>` : ""}</td>
          <td align="right" valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${badge(c.status ?? "✓ Paid")}</td>${cursorImg}</tr></table></td>
        </tr></table>`);
    case "booking":
      return paper(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="76" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" width="64" style="border:1px solid ${C.mist};border-radius:12px;">
              <tr><td bgcolor="${C.pink}" style="background:${C.pink};border-radius:11px 11px 0 0;padding:4px 0;text-align:center;font-family:${FONT.sans};font-size:11px;font-weight:800;letter-spacing:1px;color:${C.ink};">${esc(c.month.toUpperCase())}</td></tr>
              <tr><td style="padding:6px 0 2px;text-align:center;${font(TYPE.amount)}color:${C.ink};">${esc(c.day)}</td></tr>
              <tr><td style="padding:0 0 8px;text-align:center;${font(TYPE.meta)}color:${C.meta};">${esc(c.weekday)}</td></tr>
            </table>
          </td>
          <td valign="top">
            ${label("Booking")}
            <div style="margin-top:6px;${font(TYPE.title)}color:${C.ink};">${esc(c.service)}</div>
            <div style="margin-top:4px;${font(TYPE.small)}color:${C.body};">${esc(c.client)} &middot; ${esc(c.time)}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr><td>${badge(c.status ?? "Confirmed")}</td>${cursorImg}</tr></table>
          </td>
        </tr></table>`);
    case "client":
      return paper(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="56" valign="top">${avatar(c.name, 44)}</td>
          <td valign="top">
            <div style="${font(TYPE.title)}color:${C.ink};">${esc(c.name)}</div>
            ${c.detail ? `<div style="margin-top:2px;${font(TYPE.small)}color:${C.meta};">${esc(c.detail)}</div>` : ""}
          </td>
          ${c.tag ? `<td align="right" valign="top">${badge(c.tag, "pink")}</td>` : ""}
        </tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid ${C.mist};">
          ${c.facts.map((f) => `<tr><td style="padding:10px 0 0;${font(TYPE.small)}color:${C.meta};">${esc(f.label)}</td><td align="right" style="padding:10px 0 0;${font(TYPE.small)}font-weight:600;color:${C.softBlack};">${esc(f.value)}</td></tr>`).join("")}
        </table>`);
    case "invoice":
      return paper(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>${label(`Invoice ${c.number}`)}<div style="margin-top:6px;${font(TYPE.title)}color:${C.ink};">${esc(c.client)}</div></td>
          <td align="right" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${badge(c.status ?? "Due", c.status === "Paid" ? "success" : "amber")}</td>${cursorImg}</tr></table></td>
        </tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px dashed ${C.mistDeep};">
          ${c.lines.map((l) => `<tr><td style="padding:10px 0 0;${font(TYPE.small)}color:${C.body};">${esc(l.label)}</td><td align="right" style="padding:10px 0 0;${font(TYPE.small)}color:${C.softBlack};">${esc(l.amount)}</td></tr>`).join("")}
          <tr><td style="padding:14px 0 0;${font(TYPE.small)}font-weight:700;color:${C.ink};">Total</td><td align="right" style="padding:14px 0 0;${font(TYPE.title)}font-weight:800;color:${C.ink};">${esc(c.total)}</td></tr>
        </table>`);
    case "reminder":
      return paper(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="36" valign="top"><div style="width:22px;height:22px;border:2px solid ${C.pink};border-radius:7px;"></div></td>
          <td valign="top">
            <div style="${font(TYPE.title)}color:${C.ink};">${esc(c.title)}</div>
            <div style="margin-top:4px;${font(TYPE.small)}color:${C.meta};">${esc(c.due)}${c.client ? ` &middot; ${esc(c.client)}` : ""}</div>
          </td>
          <td align="right" valign="top">${badge("Reminder", "pink")}</td>
        </tr></table>`);
  }
}

// ── Blocks ──────────────────────────────────────────────────────────────────

function renderBlock(b: Block, base: string): string {
  switch (b.type) {
    case "statement": {
      const t = b.size === "xl" ? TYPE.statementXL : TYPE.statement;
      const align = b.align ?? "left";
      return row(`
        <div class="o-statement" style="${font(t)}color:${C.ink};text-align:${align};">${rich(b.text)}</div>
        ${b.underline ? `<div style="margin-top:6px;${align === "center" ? "text-align:center;" : ""}">${img(base, "underline", 220, 16, align === "center" ? "margin:0 auto;" : "")}</div>` : ""}`,
        "8px 40px 0");
    }
    case "text":
      return row(b.paragraphs.map((p) => `<p style="margin:16px 0 0;${font(TYPE.body)}color:${C.body};text-align:${b.align ?? "left"};">${rich(p)}</p>`).join(""), "4px 40px 0");
    case "card":
      return row(`
        ${b.annotation ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td align="right" valign="bottom" style="padding:0 4px 2px 0;font-family:${FONT.serif};font-style:italic;font-size:17px;line-height:22px;color:${C.rose};">${esc(b.annotation)}</td>
          <td width="64" valign="bottom">${img(base, "arrow-down-left", 64, 56)}</td>
        </tr></table>` : ""}
        ${b.sticker ? `<div style="text-align:right;margin:${b.annotation ? "4px" : "0"} 14px -14px 0;position:relative;">${sticker(b.sticker)}</div>` : ""}
        ${uiCard(b.card, base, !!b.cursor)}`, "28px 40px 0");
    case "notifications":
      return row(b.items.map((n, i) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="background:${C.paper};border:1px solid ${C.mist};border-bottom:3px solid ${C.mistDeep};border-radius:14px;margin-top:${i ? 10 : 0}px;">
          <tr>
            <td width="52" style="padding:14px 0 14px 14px;"><div style="width:34px;height:34px;line-height:34px;border-radius:10px;background:${i === 0 ? C.pink : C.pinkSoft};color:${i === 0 ? C.ink : C.rose};text-align:center;font-size:16px;font-family:${FONT.sans};font-weight:700;">${ICON_GLYPH[n.icon]}</div></td>
            <td style="padding:14px 8px;"><div style="${font(TYPE.small)}font-weight:700;color:${C.ink};">${esc(n.title)}</div><div style="${font(TYPE.meta)}font-weight:400;color:${C.meta};margin-top:2px;">${esc(n.meta)}</div></td>
            <td align="right" style="padding:14px 16px 14px 0;${font(TYPE.meta)}color:${C.meta};white-space:nowrap;">${esc(n.time)}</td>
          </tr>
        </table>`).join(""), "28px 40px 0");
    case "beforeAfter": {
      // Fluid columns: side by side on desktop, stacked on phones - no media query needed.
      const col = (inner: string) => `<div class="o-col" style="display:inline-block;width:100%;max-width:262px;vertical-align:top;">${inner}</div>`;
      return row(`
        <div style="font-size:0;text-align:center;">
          ${col(paper(`<div style="${font(TYPE.eyebrow)}text-transform:uppercase;color:${C.meta};">Before</div>
            ${b.before.map((x) => `<div style="margin-top:10px;${font(TYPE.small)}color:${C.meta};text-decoration:line-through;">${esc(x)}</div>`).join("")}`, { bg: C.canvas }))}
          <div class="o-arrow" style="display:inline-block;width:56px;vertical-align:middle;padding:12px 0;">${img(base, "arrow-right", 48, 24, "margin:0 auto;")}</div>
          ${col(paper(`<div style="${font(TYPE.eyebrow)}text-transform:uppercase;color:${C.rose};">With Orbit</div>
            ${b.after.map((x) => `<div style="margin-top:10px;${font(TYPE.small)}font-weight:600;color:${C.ink};">&#10003;&nbsp; ${esc(x)}</div>`).join("")}`, { border: C.pink }))}
        </div>`, "28px 24px 0");
    }
    case "steps":
      return row(`
        <div style="${font(TYPE.eyebrow)}text-transform:uppercase;color:${C.rose};">${img(base, "spark", 12, 12, "display:inline-block;vertical-align:-1px;margin-right:6px;")}${esc(b.title)}</div>
        ${b.items.map((it, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr>
          <td width="40" valign="top"><div style="width:28px;height:28px;line-height:28px;border-radius:999px;border:1.5px solid ${C.ink};text-align:center;font-family:${FONT.sans};font-size:13px;font-weight:800;color:${C.ink};">${i + 1}</div></td>
          <td valign="top" style="padding-top:3px;"><div style="${font(TYPE.body)}font-weight:700;color:${C.ink};">${rich(it.title)}</div>${it.body ? `<div style="${font(TYPE.small)}color:${C.meta};margin-top:2px;">${rich(it.body)}</div>` : ""}</td>
        </tr></table>`).join("")}`, "28px 40px 0");
    case "checklist": {
      const done = b.items.filter((x) => x.done).length;
      const pct = Math.round((done / Math.max(1, b.items.length)) * 100);
      return row(paper(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="${font(TYPE.eyebrow)}text-transform:uppercase;color:${C.meta};">${esc(b.title)}</td>
          <td align="right" style="${font(TYPE.meta)}color:${C.rose};">${done}/${b.items.length} done</td>
        </tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;"><tr>
          <td width="${pct}%" height="6" bgcolor="${C.pink}" style="background:${C.pink};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
          <td height="6" bgcolor="${C.mist}" style="background:${C.mist};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
        ${b.items.map((it) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
          <td width="32" valign="top"><div style="width:20px;height:20px;line-height:20px;border-radius:6px;text-align:center;font-family:${FONT.sans};font-size:12px;font-weight:800;${it.done ? `background:${C.ink};color:${C.paper};` : `border:1.5px solid ${C.mistDeep};line-height:17px;width:17px;height:17px;`}">${it.done ? "&#10003;" : "&nbsp;"}</div></td>
          <td style="${font(TYPE.small)}${it.done ? `color:${C.meta};text-decoration:line-through;` : `font-weight:700;color:${C.ink};`}">${esc(it.title)}</td>
        </tr></table>`).join("")}`), "28px 40px 0");
    }
    case "stat":
      return row(`
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="${font(TYPE.statement)}color:${C.ink};">${esc(b.value)}</td>
          <td style="padding-left:10px;${font(TYPE.small)}color:${C.meta};">${esc(b.label)}</td>
        </tr></table>
        ${b.progress !== undefined ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;max-width:260px;"><tr>
          <td width="${b.progress}%" height="6" bgcolor="${C.pink}" style="background:${C.pink};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
          <td height="6" bgcolor="${C.mist}" style="background:${C.mist};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td></tr></table>` : ""}`, "24px 40px 0");
    case "divider":
      return row(img(base, "orbit-line", 560, 45, "width:100%;max-width:560px;height:auto;margin:0 auto;"), "28px 40px 0");
    case "cta": {
      const align = b.align ?? "left";
      return row(`
        <table role="presentation" cellpadding="0" cellspacing="0" ${align === "center" ? 'align="center"' : ""}><tr>
          <td bgcolor="${C.pink}" style="background:${C.pink};border-radius:12px;border-bottom:3px solid ${C.roseMuted};">
            <a href="${esc(b.url)}" style="display:inline-block;padding:15px 26px;font-family:${FONT.sans};font-size:16px;font-weight:800;line-height:20px;color:${C.ink};text-decoration:none;border-radius:12px;">${esc(b.text)}&nbsp;&nbsp;&rarr;</a>
          </td></tr></table>
        ${b.secondary ? `<p style="margin:14px 0 0;${font(TYPE.small)}text-align:${align};"><a href="${esc(b.secondary.url)}" style="color:${C.body};text-decoration:underline;">${esc(b.secondary.text)}</a></p>` : ""}`,
        "32px 40px 0");
    }
    case "signoff":
      return row(`<p style="margin:0;font-family:${FONT.serif};font-style:italic;font-size:17px;line-height:26px;color:${C.body};">${b.lines.map(esc).join("<br>")}</p>`, "36px 40px 0");
  }
}

/**
 * One block as a standalone table row, on the paper sheet - used by the
 * design-system documentation so its previews are the real renderer's output.
 */
export function renderBlockPreview(b: Block, appUrl: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="max-width:${WIDTH}px;background:${C.paper};">${renderBlock(b, appUrl)}<tr><td style="padding:28px 0 0;"></td></tr></table>`;
}

// ── Document ───────────────────────────────────────────────────────────────

export function renderEmail(c: EmailContent, f: EmailFooter): { html: string; text: string } {
  const base = f.appUrl;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(c.title)}</title>
<style>
  @media (max-width:520px){
    .o-pad{padding-left:22px !important;padding-right:22px !important;}
    .o-statement{font-size:${TYPE.statementMobile[0]}px !important;line-height:${TYPE.statementMobile[1]}px !important;}
    .o-sheet{border-radius:0 !important;border-left:0 !important;border-right:0 !important;}
    .o-col{max-width:100% !important;display:block !important;margin-top:10px !important;}
    .o-arrow{display:none !important;}
  }
</style></head>
<body style="margin:0;padding:0;background:${C.canvas};" bgcolor="${C.canvas}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.canvas}" style="background:${C.canvas};">
<tr><td align="center" style="padding:24px 0 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="o-sheet" bgcolor="${C.paper}" style="max-width:${WIDTH}px;background:${C.paper};border:1px solid ${C.mist};border-radius:24px;">

    <tr><td class="o-pad" style="padding:28px 40px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td><img src="${esc(base)}/icons/icon-192.png" width="28" height="28" alt="Orbit" style="display:block;border-radius:8px;"></td>
          <td style="padding-left:8px;font-family:${FONT.sans};font-size:18px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">Orbit<span style="color:${C.pink};">.</span></td>
        </tr></table></td>
        ${c.eyebrow ? `<td align="right" valign="middle" style="${font(TYPE.eyebrow)}text-transform:uppercase;color:${C.rose};">${img(base, "spark", 12, 12, "display:inline-block;vertical-align:-1px;margin-right:6px;")}${esc(c.eyebrow)}</td>` : ""}
      </tr></table>
    </td></tr>

    ${c.blocks.map((b) => renderBlock(b, base)).join("\n")}

    <tr><td style="padding:40px 0 0;">&nbsp;</td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${WIDTH}px;">
    <tr><td class="o-pad" style="padding:24px 40px 0;${font(TYPE.meta)}font-weight:400;line-height:20px;color:${C.meta};">
      ${f.reason ? `${esc(f.reason)}<br>` : ""}
      ${f.preferencesUrl ? `<a href="${esc(f.preferencesUrl)}" style="color:${C.meta};text-decoration:underline;">Email preferences</a>` : ""}${f.preferencesUrl && f.unsubscribeUrl ? " &nbsp;&middot;&nbsp; " : ""}${f.unsubscribeUrl ? `<a href="${esc(f.unsubscribeUrl)}" style="color:${C.meta};text-decoration:underline;">Unsubscribe</a>` : ""}<br>
      Orbit &middot; Run your business. Not the admin. &middot; getorbitcrm.com
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  return { html, text: toText(c, f) };
}

function cardText(c: UICard): string[] {
  switch (c.kind) {
    case "payment": return [`[Payment received] ${c.amount} from ${c.client} - ${c.status ?? "Paid"}`];
    case "booking": return [`[Booking] ${c.service} with ${c.client}, ${c.weekday} ${c.day} ${c.month} at ${c.time} - ${c.status ?? "Confirmed"}`];
    case "client": return [`[Client] ${c.name}${c.detail ? ` (${c.detail})` : ""}`, ...c.facts.map((f) => `  ${f.label}: ${f.value}`)];
    case "invoice": return [`[Invoice ${c.number}] ${c.client} - total ${c.total} (${c.status ?? "Due"})`];
    case "reminder": return [`[Reminder] ${c.title} - ${c.due}`];
  }
}

function toText(c: EmailContent, f: EmailFooter): string {
  const out: string[] = [];
  for (const b of c.blocks) {
    switch (b.type) {
      case "statement": out.push(plain(b.text).toUpperCase(), ""); break;
      case "text": b.paragraphs.forEach((p) => out.push(plain(p), "")); break;
      case "card": if (b.annotation) out.push(`(${b.annotation})`); out.push(...cardText(b.card), ""); break;
      case "notifications": b.items.forEach((n) => out.push(`- ${n.title} · ${n.meta} · ${n.time}`)); out.push(""); break;
      case "beforeAfter": out.push(`Before: ${b.before.join(", ")}`, `With Orbit: ${b.after.join(", ")}`, ""); break;
      case "steps": out.push(b.title.toUpperCase(), ...b.items.map((it, i) => `${i + 1}. ${plain(it.title)}${it.body ? ` - ${plain(it.body)}` : ""}`), ""); break;
      case "checklist": out.push(b.title.toUpperCase(), ...b.items.map((it) => `${it.done ? "[x]" : "[ ]"} ${it.title}`), ""); break;
      case "stat": out.push(`${b.value} ${b.label}`, ""); break;
      case "cta": out.push(`${b.text}: ${b.url}`, ...(b.secondary ? [`${b.secondary.text}: ${b.secondary.url}`] : []), ""); break;
      case "signoff": out.push(...b.lines, ""); break;
      case "divider": break;
    }
  }
  out.push("---");
  if (f.reason) out.push(f.reason);
  if (f.preferencesUrl) out.push(`Email preferences: ${f.preferencesUrl}`);
  if (f.unsubscribeUrl) out.push(`Unsubscribe: ${f.unsubscribeUrl}`);
  out.push("Orbit · getorbitcrm.com");
  return out.join("\n");
}
