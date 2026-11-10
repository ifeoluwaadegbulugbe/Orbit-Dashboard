import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { OrbitMark } from "@/components/brand/OrbitMark";
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <OrbitMark size={32} />
            <span className="text-card-title font-bold">
              Orbit<span className="text-[var(--color-primary)]">.</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 lg:py-14">
        {children}
      </main>
    </div>
  );
}
