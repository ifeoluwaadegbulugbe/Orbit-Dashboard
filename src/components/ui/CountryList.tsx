"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { COUNTRIES, type Country } from "@/lib/countries";

/**
 * Searchable country list, grouped Africa first. Used by onboarding and the
 * Profile country picker.
 */
export function CountryList({
  selectedCode,
  onSelect,
}: {
  selectedCode: string;
  onSelect: (c: Country) => void;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (c: Country) =>
      !q || c.name.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q) || c.code.toLowerCase() === q;
    const list = COUNTRIES.filter(match);
    return (["Africa", "Rest of the world"] as const)
      .map((region) => ({ region, items: list.filter((c) => c.region === region) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div>
      <label className="flex items-center gap-2 h-11 px-3 mb-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white focus-within:border-[var(--color-primary)]">
        <Search className="h-4 w-4 text-[var(--color-muted)] flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search country or currency"
          aria-label="Search country or currency"
          className="flex-1 min-w-0 bg-transparent text-body outline-none"
        />
      </label>

      <div className="max-h-[360px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
        {groups.length === 0 && (
          <p className="px-5 py-6 text-small text-[var(--color-muted)] text-center">No country matches “{query}”.</p>
        )}
        {groups.map((g) => (
          <div key={g.region}>
            <div className="sticky top-0 z-10 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-canvas)] border-b border-[var(--color-border)]">
              {g.region}
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {g.items.map((c) => {
                const isActive = selectedCode === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onSelect(c)}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors ${
                      isActive ? "bg-[var(--color-primary-subtle)]" : "hover:bg-[var(--color-canvas)]"
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0">{c.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-body font-semibold truncate">{c.name}</div>
                      <div className="text-small text-[var(--color-muted)]">
                        {c.currency} · {c.symbol}
                      </div>
                    </div>
                    {isActive && <Check className="h-5 w-5 text-[var(--color-primary)] flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
