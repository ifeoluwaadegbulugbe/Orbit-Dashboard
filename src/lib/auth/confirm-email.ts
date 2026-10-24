/**
 * "Confirm your email" for new accounts, sent through Orbit's own email
 * (Resend), not Supabase's rate-limited mailer.
 *
 * Supabase's admin generateLink gives a single-use token without sending
 * anything. The email links to /auth/confirm, a page with a button: the
 * token is only spent when a person taps it, so email scanners that open
 * links can't confirm (or burn) it.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/server";
import { renderEmail } from "@/lib/email-design/render";

export function confirmUrl(origin: string, tokenHash: string, type: string): string {
  return `${origin}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
}

export async function sendConfirmationEmail(to: string, link: string, firstName: string | null, origin: string) {
  const { html, text } = renderEmail(
    {
      preheader: "One tap and your Orbit account is ready.",
      eyebrow: "Confirm your email",
      title: "Confirm your email",
      blocks: [
        { type: "statement", text: "One tap and *you're in.*" },
        { type: "text", paragraphs: [`${firstName ? `Hi ${firstName}, thanks` : "Thanks"} for signing up to Orbit. Confirm this is your email address and we'll take you straight to your setup.`] },
        { type: "cta", text: "Confirm my email", url: link },
        { type: "text", paragraphs: ["The link works once and expires in 24 hours. If you didn't sign up for Orbit, ignore this email and nothing will happen."] },
      ],
    },
    { appUrl: origin, reason: "You're getting this because this email address was used to sign up to Orbit." },
  );
  return sendEmail({ to, subject: "Confirm your email for Orbit", html, text });
}

/** New link for an account that exists but isn't confirmed yet. Quietly does nothing otherwise. */
export async function resendConfirmation(supabase: SupabaseClient, email: string, origin: string): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles").select("full_name, email_confirmed").ilike("email", email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (!profile || profile.email_confirmed !== false) return;
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    console.warn("[confirm-email] could not create link:", error?.message);
    return;
  }
  const first = (profile.full_name ?? "").trim().split(/\s+/)[0] || null;
  await sendConfirmationEmail(email, confirmUrl(origin, data.properties.hashed_token, data.properties.verification_type), first, origin);
}
