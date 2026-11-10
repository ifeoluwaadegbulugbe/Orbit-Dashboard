import Link from "next/link";

import { OrbitMark } from "@/components/brand/OrbitMark";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-canvas)]">
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <OrbitMark size={32} />
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
