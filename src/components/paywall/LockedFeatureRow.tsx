"use client";

import { Lock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface LockedFeatureRowProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  onPress: () => void;
}

/**
 * Pro-only feature row shown in lists (e.g. Profile screen). Free users see
 * the lock badge; tapping fires onPress (which should open the paywall).
 */
export function LockedFeatureRow({
  icon: Icon,
  iconColor,
  title,
  description,
  onPress,
}: LockedFeatureRowProps) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-border-light)] rounded-[var(--radius-md)] transition-colors text-left"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${iconColor}1A` }}
      >
        <Icon className="h-5 w-5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--color-ink)] truncate">{title}</div>
        <div className="text-xs text-[var(--color-muted)] truncate">{description}</div>
      </div>
      <Badge tone="primary" icon={<Lock className="h-3 w-3" />}>
        Pro
      </Badge>
    </button>
  );
}
