"use client";

import { toast } from "@/stores/toastStore";
import { socialChatUrl, SOCIAL_LABEL, type SocialPlatform } from "@/lib/social";
import { InstagramIcon, TikTokIcon } from "@/components/ui/SocialIcons";

/**
 * Instagram/TikTok version of a wa.me link. Those apps can't take a
 * pre-written message, so we copy it and open the chat; the owner pastes
 * and sends. Must be called straight from a tap: the copy and the new
 * window are both started before anything is awaited, or phones block them.
 * `text` may still be loading (e.g. a link being created).
 */
export async function copyAndOpenChat(platform: SocialPlatform, handle: string, text: string | Promise<string>): Promise<boolean> {
  let copying: Promise<unknown> | null = null;
  if (typeof text !== "string" && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    // Safari only allows a copy that starts during the tap, so hand it the pending text.
    copying = navigator.clipboard.write([
      new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) }),
    ]);
  } else if (typeof text === "string") {
    copying = navigator.clipboard?.writeText(text) ?? null;
  }
  copying?.catch(() => {}); // reported below, once the text is ready
  const win = window.open("about:blank", "_blank");
  try {
    const finalText = await text;
    if (!copying) copying = navigator.clipboard?.writeText(finalText) ?? Promise.reject();
    await copying;
    if (win) win.location.href = socialChatUrl(handle, platform);
    else window.location.href = socialChatUrl(handle, platform);
    toast(`Message copied. Paste it in ${SOCIAL_LABEL[platform]}.`, "success");
    return true;
  } catch {
    win?.close();
    toast("Couldn't copy the message. Try again.", "danger");
    return false;
  }
}

/** Opens the chat (or copies `text` and opens it). */
export function SocialSendButton({
  platform, handle, text, label, className,
}: {
  platform: SocialPlatform;
  handle: string;
  text?: string;
  label?: string;
  className?: string;
}) {
  function go() {
    if (text) void copyAndOpenChat(platform, handle, text);
    else window.open(socialChatUrl(handle, platform), "_blank", "noopener,noreferrer");
  }
  const Icon = platform === "instagram" ? InstagramIcon : TikTokIcon;
  return (
    <button type="button" onClick={go} className={className}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label ?? (text ? `Copy & open ${SOCIAL_LABEL[platform]}` : SOCIAL_LABEL[platform])}
    </button>
  );
}

/** The client's first social handle, Instagram before TikTok. */
export function firstSocial(c: { instagram?: string | null; tiktok?: string | null } | null | undefined): { platform: SocialPlatform; handle: string } | null {
  if (c?.instagram) return { platform: "instagram", handle: c.instagram };
  if (c?.tiktok) return { platform: "tiktok", handle: c.tiktok };
  return null;
}
