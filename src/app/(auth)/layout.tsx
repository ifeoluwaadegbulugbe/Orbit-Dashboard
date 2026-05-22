import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-canvas)]">
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Orbit<span className="text-[var(--color-primary)]">.</span>
          </span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
