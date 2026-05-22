"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Users, Briefcase, CreditCard, BarChart3, Bell, Settings, Sparkles,
  Receipt, Zap, Palette, Link2, MessageSquare, Download, BookOpen, Scissors,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/Badge";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MAIN_NAV: NavItem[] = [
  { href: "/home",      label: "Home",       icon: Home },
  { href: "/clients",   label: "Clients",    icon: Users },
  { href: "/work",      label: "Work",       icon: Briefcase },
  { href: "/services",  label: "Services",   icon: Scissors },
  { href: "/payments",  label: "Payments",   icon: CreditCard },
  { href: "/analytics", label: "Analytics",  icon: BarChart3 },
  { href: "/reminders", label: "Reminders",  icon: Bell },
  { href: "/help",      label: "Help",       icon: BookOpen },
  { href: "/profile",   label: "Profile",    icon: Settings },
];

/** Pro feature shortcuts - only shown when subscription.isPro is true. */
const PRO_NAV: NavItem[] = [
  { href: "/ai-assistant",     label: "AI Assistant",    icon: Sparkles },
  { href: "/payments/new",     label: "Invoice Builder", icon: Receipt },
  { href: "/payment-settings", label: "Online Payments", icon: CreditCard },
  { href: "/automations",      label: "Automations",     icon: Zap },
  { href: "/branding",         label: "Branding",        icon: Palette },
  { href: "/booking-link",     label: "Booking Link",    icon: Link2 },
  { href: "/templates",        label: "Templates",       icon: MessageSquare },
  { href: "/export",           label: "Export Data",     icon: Download },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isPro, isOnTrial, trialDaysLeft } = useSubscription();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-[var(--color-border)] bg-white">
      {/* Brand */}
      <div className="px-7 pt-8 pb-6 flex-shrink-0">
        <Link href="/home" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-card-title font-bold text-[var(--color-ink)]">
            Orbit<span className="text-[var(--color-primary)]">.</span>
          </span>
        </Link>
      </div>

      {/* Scrollable nav region - main nav + Pro section */}
      <nav className="flex-1 px-4 overflow-y-auto pb-4">
        {/* Main */}
        <div className="space-y-1.5">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        {/* Pro section - only when Pro is active */}
        {isPro && (
          <div className="mt-6 pt-5 border-t border-[var(--color-border)]/60">
            <div className="px-4 mb-2 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-[var(--color-primary)]" />
              <span className="text-tiny font-bold uppercase tracking-wider text-[var(--color-primary)]">
                Pro Tools
              </span>
            </div>
            <div className="space-y-1.5">
              {PRO_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Plan card */}
      <div className="px-4 pt-4 pb-7 border-t border-[var(--color-border)]/60 flex-shrink-0">
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-primary-subtle)] p-5">
          {isPro ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
                <span className="text-tiny font-bold text-[var(--color-primary-dark)] uppercase tracking-wider">
                  {isOnTrial ? "Pro Trial" : "Pro"}
                </span>
              </div>
              {isOnTrial && trialDaysLeft !== null && (
                <p className="text-small text-[var(--color-ink-mid)] leading-relaxed">
                  {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in your trial
                </p>
              )}
              {!isOnTrial && (
                <p className="text-small text-[var(--color-ink-mid)] leading-relaxed">
                  All Pro features unlocked
                </p>
              )}
            </>
          ) : (
            <>
              <Badge tone="primary" className="mb-3">Free Plan</Badge>
              <p className="text-small text-[var(--color-ink-mid)] leading-relaxed mb-4">
                Unlock unlimited clients, AI tools and more.
              </p>
              <Link
                href="/profile?upgrade=1"
                className="block text-center text-small font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-full py-2.5 transition-colors"
              >
                Try Pro free
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active =
    pathname === item.href ||
    (item.href !== "/payments" && pathname.startsWith(`${item.href}/`));
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-full text-small font-semibold transition-colors",
        active
          ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]"
          : "text-[var(--color-ink-light)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-ink)]",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px]", active && "text-[var(--color-primary)]")} />
      {item.label}
    </Link>
  );
}
