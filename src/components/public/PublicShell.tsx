import { Sparkles } from "lucide-react";

/** Minimal frame for pages clients see without logging in (reviews, "my appointments"). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-body font-bold">
            Orbit<span className="text-[var(--color-primary)]">.</span>
          </span>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">{children}</main>
    </div>
  );
}

export function PublicMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6 sm:p-8 text-center">
      <h1 className="text-card-title font-bold">{title}</h1>
      <p className="mt-2 text-small text-[var(--color-ink-light)] leading-relaxed">{body}</p>
    </div>
  );
}
