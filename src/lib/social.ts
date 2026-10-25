/**
 * Instagram and TikTok handles for clients who aren't reachable by phone.
 *
 * Owners paste whatever they have: "@amaka.glam", "amaka.glam", or a
 * profile link like "https://www.instagram.com/amaka.glam/?hl=en". We keep
 * just the username. Neither app lets a link carry a pre-written message
 * (unlike wa.me), so "send" means: copy the message, open the chat, paste.
 */

export type SocialPlatform = "instagram" | "tiktok";

const RULES: Record<SocialPlatform, { host: RegExp; max: number }> = {
  instagram: { host: /(?:^|\.)(instagram\.com|instagr\.am|ig\.me)$/i, max: 30 },
  tiktok: { host: /(?:^|\.)tiktok\.com$/i, max: 24 },
};

/** The bare username, or null if what was typed can't be one. */
export function normalizeHandle(raw: string | null | undefined, platform: SocialPlatform): string | null {
  let s = (raw ?? "").trim();
  if (!s) return null;
  if (/[/:]/.test(s)) {
    try {
      const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      if (!RULES[platform].host.test(url.hostname)) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      // ig.me/m/<name> is a DM link; everything else is /<name> or /@<name>
      s = (parts[0] === "m" && parts[1] ? parts[1] : parts[0]) ?? "";
    } catch {
      return null;
    }
  }
  s = s.replace(/^@+/, "").toLowerCase();
  if (!s || s.length > RULES[platform].max || !/^[a-z0-9._]+$/.test(s)) return null;
  return s;
}

/** Opens the chat with them in the Instagram app (or the profile on TikTok, which has no chat link). */
export function socialChatUrl(handle: string, platform: SocialPlatform): string {
  return platform === "instagram" ? `https://ig.me/m/${handle}` : `https://www.tiktok.com/@${handle}`;
}

export function socialProfileUrl(handle: string, platform: SocialPlatform): string {
  return platform === "instagram" ? `https://www.instagram.com/${handle}` : `https://www.tiktok.com/@${handle}`;
}

export const SOCIAL_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", tiktok: "TikTok" };

/** How to show a client in a list: phone if we have it, else their handle. */
export function primaryContact(c: { phone?: string | null; instagram?: string | null; tiktok?: string | null; email?: string | null }): string {
  if (c.phone?.trim()) return c.phone;
  if (c.instagram) return `@${c.instagram} on Instagram`;
  if (c.tiktok) return `@${c.tiktok} on TikTok`;
  return c.email ?? "";
}
