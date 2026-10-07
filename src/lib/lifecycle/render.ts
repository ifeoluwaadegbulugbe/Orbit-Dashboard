/**
 * Orbit's lifecycle email layout: logo, one heading, a few short
 * paragraphs, ONE button, a footer with sender identification plus
 * unsubscribe/preferences links. Table-based inline-styled HTML so it
 * renders in Gmail, Outlook and phone mail apps; plain-text fallback too.
 */

export interface LifecycleContent {
  /** Grey preview line shown after the subject in the inbox. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta: { text: string; url: string };
  /** Optional quiet text link under the button. */
  secondary?: { text: string; url: string };
  /** Signs off as a person, which reads less like a newsletter. */
  signoff?: string;
}

export interface FooterLinks {
  unsubscribeUrl: string;
  preferencesUrl: string;
  appUrl: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** **bold** in copy -> <strong>; everything else escaped. */
function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1A1A1A;">$1</strong>');
}

export function renderLifecycleEmail(c: LifecycleContent, f: FooterLinks): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#F2F1EF;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F1EF;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td style="padding:0 4px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td><img src="${esc(f.appUrl)}/icons/icon-192.png" width="28" height="28" alt="" style="display:block;border-radius:8px;"></td>
        <td style="padding-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:18px;font-weight:800;color:#1A1A1A;">Orbit<span style="color:#E8557A;">.</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid #E5E3DF;border-radius:16px;padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:800;color:#1A1A1A;">${esc(c.heading)}</h1>
      ${c.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3D3D3D;">${inline(p)}</p>`).join("\n      ")}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr><td style="border-radius:999px;background:#E8557A;">
        <a href="${esc(c.cta.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(c.cta.text)}</a>
      </td></tr></table>
      ${c.secondary ? `<p style="margin:14px 0 0;font-size:13px;"><a href="${esc(c.secondary.url)}" style="color:#6B6B6B;">${esc(c.secondary.text)}</a></p>` : ""}
      ${c.signoff ? `<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#3D3D3D;">${inline(c.signoff)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:18px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9A9893;text-align:center;">
      You're getting this because you have an Orbit account.<br>
      <a href="${esc(f.preferencesUrl)}" style="color:#9A9893;">Email preferences</a> &nbsp;·&nbsp; <a href="${esc(f.unsubscribeUrl)}" style="color:#9A9893;">Unsubscribe</a><br>
      Orbit · getorbitcrm.com
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    c.heading,
    "",
    // blank line between paragraphs (list lines starting with "•" stay together)
    ...c.paragraphs.flatMap((p, i) => {
      const line = p.replace(/\*\*(.+?)\*\*/g, "$1");
      const isList = p.startsWith("•") && c.paragraphs[i + 1]?.startsWith("•");
      return isList ? [line] : [line, ""];
    }),
    `${c.cta.text}: ${c.cta.url}`,
    c.secondary ? `${c.secondary.text}: ${c.secondary.url}` : "",
    c.signoff ? `\n${c.signoff.replace(/\*\*(.+?)\*\*/g, "$1")}` : "",
    "",
    "---",
    `Email preferences: ${f.preferencesUrl}`,
    `Unsubscribe: ${f.unsubscribeUrl}`,
    "Orbit · getorbitcrm.com",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");

  return { html, text };
}
