"use client";

import { Headphones, Mail, MessageCircle, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuthStore } from "@/stores/authStore";

/**
 * Contact support. Pro accounts get priority support: emails are tagged
 * "[Pro]" in the subject (filter on it in the inbox) and, when
 * NEXT_PUBLIC_SUPPORT_WHATSAPP is set (digits with country code, e.g.
 * 2348012345678), a direct WhatsApp line. Reply-time promises live here.
 */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "getorbitcrm@gmail.com";
const SUPPORT_WHATSAPP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "").replace(/\D/g, "");
const PRO_REPLY = "within 1 business day";
const FREE_REPLY = "within 3 business days";

export function ContactSupport() {
  const { isPro } = useSubscription();
  const email = useAuthStore((s) => s.user?.email ?? "");

  const subject = isPro ? "[Pro] Orbit support" : "Orbit support";
  const body = `Hi Orbit team,\n\n\n\n---\nAccount: ${email}\nPlan: ${isPro ? "Pro" : "Free"}`;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const whatsapp = isPro && SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi Orbit, I'm on Pro (${email}). `)}`
    : null;

  return (
    <section id="contact" className="scroll-mt-20 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
      <div className="flex items-center gap-2">
        <Headphones className="h-5 w-5 text-[var(--color-primary)]" />
        <h2 className="text-section font-bold">Contact support</h2>
        {isPro && (
          <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] text-tiny font-bold">
            <Sparkles className="h-3 w-3" /> Priority
          </span>
        )}
      </div>
      <p className="mt-2 text-small text-[var(--color-ink-light)]">
        {isPro
          ? `You're on Pro, so you get priority support. We reply ${PRO_REPLY}.`
          : `Email us and we'll reply ${FREE_REPLY}. Pro accounts get priority support.`}
      </p>
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <a href={mailto} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--color-primary)] text-white text-small font-semibold hover:bg-[var(--color-primary-dark)] transition-colors">
          <Mail className="h-4 w-4" /> Email support
        </a>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-small font-semibold hover:opacity-90 transition-opacity">
            <MessageCircle className="h-4 w-4" /> WhatsApp support
          </a>
        )}
      </div>
    </section>
  );
}
