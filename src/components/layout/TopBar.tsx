"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "there";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-canvas)]/85 backdrop-blur-md border-b border-[var(--color-border)]/60">
      <div className="flex items-center gap-3 px-5 lg:px-8 py-3.5">
        {/* Mobile menu */}
        <button
          onClick={onMenuClick}
          className="lg:hidden -ml-1 p-1.5 rounded-lg hover:bg-[var(--color-border-light)]"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-[var(--color-ink-mid)]" />
        </button>

        {/* Search */}
        <GlobalSearch />

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Notifications */}
          <NotificationBell />

          {/* Profile menu */}
          <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-[var(--color-border-light)] transition-colors"
          >
            <Avatar name={displayName} imageUrl={profile?.avatar_url} size={36} />
          </button>
          {menuOpen && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 top-12 z-20 w-56 rounded-[var(--radius-lg)] bg-white border border-[var(--color-border)] shadow-soft-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{displayName}</p>
                  <p className="text-xs text-[var(--color-muted)] truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/40 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
