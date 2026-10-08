/**
 * Orbit's lifecycle email design: "night sky" - a dark full-bleed canvas,
 * a huge italic all-caps headline in Orbit pink, a space illustration per
 * campaign, a short intro, a pink section label with numbered step cards,
 * and one bright pill button. Footer carries sender identification plus
 * preferences/unsubscribe.
 *
 * Built for real inboxes: table layout, inline styles, bgcolor attributes
 * (so Outlook/Gmail keep the dark canvas), system fonts (Gmail drops web
 * fonts), PNG art (Gmail drops SVG), no text baked into images.
 */

export interface LifecycleContent {
  /** Grey preview line shown after the subject in the inbox. */
  preheader: string;
  /** Small chip above the headline, e.g. "SETUP · STEP 1". */
  kicker?: string;
  /** Big headline - 2 to 5 punchy words; rendered in caps. */
  headline: string;
  /** Hero illustration key -> /email/hero-<key>.png */
  hero?: string;
  /** Short intro - 1 to 3 brief paragraphs. **bold** supported. */
  paragraphs: string[];
  /** Pink section label + numbered step cards (or a checklist when `done` is set). */
  section?: {
    title: string;
    /** Lighter text after the title, like "(2 MINS)". */
    note?: string;
    items: { title: string; body?: string; done?: boolean }[];
  };
  cta: { text: string; url: string };
  /** Optional quiet text link under the button. */
  secondary?: { text: string; url: string };
  /** Lines separated by "<br>". */
  signoff?: string;
}

export interface FooterLinks {
  unsubscribeUrl: string;
  preferencesUrl: string;
  appUrl: string;
}

const C = {
  bg: "#110C18",
  card: "#1E1729",
  cardEdge: "#3A2D4A",
  pink: "#E8557A",
  pinkHot: "#FF7AA2",
  lav: "#B9B4FF",
  cream: "#F7F1EC",
  body: "#E4DCE8",
  muted: "#A79FB0",
};
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
// Heaviest widely-installed faces for the poster-style headline.
const DISPLAY = "'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
/** **bold** -> highlighted strong; everything else escaped. */
function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.cream};font-weight:700;">$1</strong>`);
}
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1");

export function renderLifecycleEmail(c: LifecycleContent, f: FooterLinks): { html: string; text: string } {
  const sectionHtml = c.section
    ? `
    <tr><td style="padding:36px 28px 6px;font-family:${DISPLAY};font-size:20px;line-height:1.2;font-style:italic;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;color:${C.pinkHot};text-align:center;">
      ${esc(c.section.title)}${c.section.note ? ` <span style="font-family:${SANS};font-weight:400;font-style:italic;color:${C.lav};text-transform:uppercase;">${esc(c.section.note)}</span>` : ""}
    </td></tr>
    ${c.section.items.map((it, i) => `
    <tr><td style="padding:10px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.cardEdge};border-radius:16px;">
        <tr>
          <td width="52" valign="top" style="padding:16px 0 16px 16px;">
            <div style="width:34px;height:34px;line-height:34px;border-radius:999px;text-align:center;font-family:${DISPLAY};font-size:15px;font-weight:900;${it.done === true ? `background:${C.lav};color:${C.bg};` : it.done === false ? `border:2px solid ${C.cardEdge};color:${C.muted};line-height:30px;width:30px;height:30px;` : `background:${C.pink};color:${C.bg};`}">${it.done === true ? "&#10003;" : it.done === false ? "&nbsp;" : i + 1}</div>
          </td>
          <td valign="middle" style="padding:16px 18px 16px 6px;font-family:${SANS};">
            <div style="font-size:16px;font-weight:700;line-height:1.35;color:${it.done ? C.muted : C.cream};${it.done ? "text-decoration:line-through;" : ""}">${inline(it.title)}</div>
            ${it.body ? `<div style="margin-top:3px;font-size:14px;line-height:1.5;color:${C.muted};">${inline(it.body)}</div>` : ""}
          </td>
        </tr>
      </table>
    </td></tr>`).join("")}`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>${esc(c.headline)}</title>
<style>
  @media (max-width:480px){ .orbit-headline{font-size:38px !important;line-height:1 !important;} .orbit-pad{padding-left:20px !important;padding-right:20px !important;} }
  a { color:${C.pinkHot}; }
</style></head>
<body style="margin:0;padding:0;background:${C.bg};" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 12px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

    <!-- header -->
    <tr><td class="orbit-pad" style="padding:0 28px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td><img src="${esc(f.appUrl)}/icons/icon-192.png" width="30" height="30" alt="" style="display:block;border-radius:9px;"></td>
          <td style="padding-left:9px;font-family:${DISPLAY};font-size:19px;font-weight:900;color:${C.cream};letter-spacing:-0.3px;">Orbit<span style="color:${C.pink};">.</span></td>
        </tr></table></td>
        ${c.kicker ? `<td align="right" valign="middle"><span style="display:inline-block;padding:6px 12px;border:1px solid ${C.pink};border-radius:999px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.pinkHot};">&#10022; ${esc(c.kicker)}</span></td>` : ""}
      </tr></table>
    </td></tr>

    <!-- headline -->
    <tr><td class="orbit-pad orbit-headline" style="padding:6px 28px 20px;font-family:${DISPLAY};font-size:48px;line-height:0.98;font-style:italic;font-weight:900;letter-spacing:-1.5px;text-transform:uppercase;color:${C.pinkHot};">
      ${esc(c.headline)}
    </td></tr>

    ${c.hero ? `<!-- hero -->
    <tr><td style="padding:0 12px;">
      <img src="${esc(f.appUrl)}/email/hero-${esc(c.hero)}.png" width="536" alt="" style="display:block;width:100%;max-width:536px;height:auto;border-radius:20px;border:0;">
    </td></tr>` : ""}

    <!-- intro -->
    <tr><td class="orbit-pad" style="padding:28px 28px 0;font-family:${SANS};text-align:center;">
      ${c.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${C.body};">${inline(p)}</p>`).join("\n      ")}
    </td></tr>

    ${sectionHtml}

    <!-- button -->
    <tr><td align="center" style="padding:30px 28px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${C.pinkHot}" style="border-radius:999px;background:${C.pinkHot};">
        <a href="${esc(c.cta.url)}" style="display:inline-block;padding:16px 36px;font-family:${SANS};font-size:16px;font-weight:800;color:${C.bg};text-decoration:none;border-radius:999px;">${esc(c.cta.text)} &rarr;</a>
      </td></tr></table>
      ${c.secondary ? `<p style="margin:16px 0 0;font-family:${SANS};font-size:13px;"><a href="${esc(c.secondary.url)}" style="color:${C.lav};">${esc(c.secondary.text)}</a></p>` : ""}
    </td></tr>

    ${c.signoff ? `<tr><td class="orbit-pad" style="padding:30px 28px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.muted};text-align:center;">${c.signoff.split("<br>").map(inline).join("<br>")}</td></tr>` : ""}

    <!-- footer -->
    <tr><td style="padding:36px 28px 0;"><div style="height:1px;background:${C.cardEdge};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
    <tr><td style="padding:20px 28px 0;font-family:${SANS};font-size:12px;line-height:1.8;color:${C.muted};text-align:center;">
      You're getting this because you have an Orbit account.<br>
      <a href="${esc(f.preferencesUrl)}" style="color:${C.muted};text-decoration:underline;">Update your preferences</a> or <a href="${esc(f.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">unsubscribe</a>.<br>
      &#10022; Orbit &middot; getorbitcrm.com
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;

  const text = [
    plain(c.headline).toUpperCase(),
    "",
    ...c.paragraphs.flatMap((p) => [plain(p), ""]),
    ...(c.section
      ? [
          `${c.section.title}${c.section.note ? ` ${c.section.note}` : ""}`,
          ...c.section.items.map((it, i) => {
            const mark = it.done === true ? "[x]" : it.done === false ? "[ ]" : `${i + 1}.`;
            return `${mark} ${plain(it.title)}${it.body ? ` - ${plain(it.body)}` : ""}`;
          }),
          "",
        ]
      : []),
    `${c.cta.text}: ${c.cta.url}`,
    ...(c.secondary ? [`${c.secondary.text}: ${c.secondary.url}`] : []),
    ...(c.signoff ? ["", ...c.signoff.split("<br>").map(plain)] : []),
    "",
    "---",
    `Update your preferences: ${f.preferencesUrl}`,
    `Unsubscribe: ${f.unsubscribeUrl}`,
    "Orbit · getorbitcrm.com",
  ].join("\n");

  return { html, text };
}
