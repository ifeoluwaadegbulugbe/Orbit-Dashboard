"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X, Home, Users, Briefcase, CreditCard, BarChart3, Bell, Settings, Sparkles,
  Receipt, Zap, Palette, Link2, MessageSquare, Download, BookOpen, Scissors,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";

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

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { isPro } = useSubscription();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-[var(--color-border)] shadow-soft-lg flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
          <Link href="/home" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Orbit<span className="text-[var(--color-primary)]">.</span>
            </span>
          </Link>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)]">
            <X className="h-5 w-5 text-[var(--color-ink-mid)]" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {MAIN_NAV.map((item) => (
              <Row key={item.href} item={item} pathname={pathname} onClose={onClose} />
            ))}
          </div>
          {isPro && (
            <div className="mt-5 pt-4 border-t border-[var(--color-border)]/60">
              <div className="px-3 mb-2 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-[var(--color-primary)]" />
                <span className="text-tiny font-bold uppercase tracking-wider text-[var(--color-primary)]">
                  Pro Tools
                </span>
              </div>
              <div className="space-y-1">
                {PRO_NAV.map((item) => (
                  <Row key={item.href} item={item} pathname={pathname} onClose={onClose} />
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>
    </div>
  );
}

function Row({
  item, pathname, onClose,
}: { item: NavItem; pathname: string; onClose: () => void }) {
  const Icon = item.icon;
  const active =
    pathname === item.href ||
    (item.href !== "/payments" && pathname.startsWith(`${item.href}/`));
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium",
        active
          ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]"
          : "text-[var(--color-ink-light)] hover:bg-[var(--color-border-light)]",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px]", active && "text-[var(--color-primary)]")} />
      {item.label}
    </Link>
  );
}
