import Link from "next/link";

import { OrbitMark } from "@/components/brand/OrbitMark";
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <header className="px-6 py-5">
        <Link href="/home" className="inline-flex items-center gap-2">
          <OrbitMark size={32} />
          <span className="text-card-title font-bold tracking-tight">
            Orbit<span className="text-[var(--color-primary)]">.</span>
          </span>
        </Link>
      </header>
      <main className="flex-1 flex items-start justify-center px-5 pb-16">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
