"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles, Receipt, CreditCard, Zap, BarChart3, Palette,
  Link2, MessageSquare, Download, ChevronRight, Lock,
  type LucideIcon,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect } from "react";

interface Tool {
  href: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}

const TOOLS: Tool[] = [
  { href: "/ai-assistant",     icon: Sparkles,      iconBg: "#FAEDF1", iconColor: "#E8557A", title: "AI Assistant",     description: "Get smart, tailored business advice 24/7." },
  { href: "/payments/new",     icon: Receipt,       iconBg: "#EDE9FF", iconColor: "#6366F1", title: "Invoice Builder",  description: "Create and share professional invoices." },
  { href: "/payment-settings", icon: CreditCard,    iconBg: "#E0F4FF", iconColor: "#0EA5E9", title: "Online Payments",  description: "Connect Paystack, Stripe or Flutterwave." },
  { href: "/automations",      icon: Zap,           iconBg: "#FEF3C7", iconColor: "#92400E", title: "Automations",      description: "Auto reminders and client follow-ups." },
  { href: "/analytics",        icon: BarChart3,     iconBg: "#DCFCE7", iconColor: "#166534", title: "Analytics+",       description: "Revenue trends and client insights." },
  { href: "/branding",         icon: Palette,       iconBg: "#FAEDF1", iconColor: "#E8557A", title: "Branding",         description: "Logo, colour and tagline for invoices." },
  { href: "/booking-link",     icon: Link2,         iconBg: "#EDE9FF", iconColor: "#6366F1", title: "Booking Link",     description: "Public link clients can book with." },
  { href: "/templates",        icon: MessageSquare, iconBg: "#FEF3C7", iconColor: "#92400E", title: "Templates",        description: "Pre-written messages for follow-ups." },
  { href: "/export",           icon: Download,      iconBg: "#E5E3DF", iconColor: "#3D3D3D", title: "Export Data",      description: "Download your data as CSV anytime." },
];

export default function ToolsPage() {
  const { isPro, isOnTrial, trialDaysLeft } = useSubscription();
  const router = useRouter();

  // Tools is Pro-only. Free users get bounced back to home.
  useEffect(() => {
    if (!isPro) router.replace("/home");
  }, [isPro, router]);

  if (!isPro) {
    return <div className="h-40 rounded-[var(--radius-xl)] skeleton" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <span className="text-tiny font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Pro tools
            {isOnTrial && trialDaysLeft !== null && ` · trial · ${trialDaysLeft}d left`}
          </span>
        </div>
        <h1 className="text-page font-bold">Your full toolkit</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2 max-w-2xl">
          Everything you need to run and grow your business - in one place.
          Pick a tool to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group flex flex-col gap-4 p-7 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm transition-all hover:shadow-soft hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: t.iconBg }}
                >
                  <Icon className="h-6 w-6" style={{ color: t.iconColor }} />
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <h3 className="text-card-title font-semibold mb-1.5">{t.title}</h3>
                <p className="text-small text-[var(--color-ink-light)] leading-relaxed">
                  {t.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
