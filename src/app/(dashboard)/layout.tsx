"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AppointmentReminders } from "@/components/providers/AppointmentReminders";
import { AssistantPanel } from "@/components/ai/AssistantPanel";
import { AiLauncherButton } from "@/components/ai/AiLauncherButton";

/**
 * Dashboard shell.
 *
 * Note: we intentionally do NOT auto-redirect logged-in users to /welcome.
 * The wizard is a signup-time experience only - the signup page sends new
 * accounts to /welcome once, and the wizard's "Enter Orbit" button takes
 * them to /home. Logins always go straight to /home.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <AppointmentReminders />
      <Sidebar />
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 lg:pt-10 pb-28 lg:pb-10 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
      <AiLauncherButton />
      <AssistantPanel />
    </div>
  );
}
