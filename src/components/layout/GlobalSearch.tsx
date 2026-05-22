"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, User, Receipt, Calendar, X } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useBookings } from "@/hooks/useBookings";
import { useCurrency } from "@/hooks/useCurrency";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Global search bar - lives in the TopBar across every screen. Filters
 * clients / invoices / bookings client-side using already-loaded data, so
 * results appear instantly without a network round-trip.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: clients = [] } = useClients();
  const { data: payments = [] } = usePayments();
  const { data: bookings = [] } = useBookings();
  const { format: formatCurrency } = useCurrency();

  // Close the dropdown when the user clicks outside.
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [router]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return { clients: [], payments: [], bookings: [] };
    const fuzz = (s: string) => s.toLowerCase().includes(q);

    return {
      clients: clients
        .filter((c) => fuzz(c.name) || fuzz(c.phone) || (c.email && fuzz(c.email)))
        .slice(0, 5),
      payments: payments
        .filter(
          (p) =>
            fuzz(p.client_name) ||
            (p.invoice_number && fuzz(p.invoice_number)) ||
            String(p.amount).includes(q),
        )
        .slice(0, 5),
      bookings: bookings
        .filter((b) => fuzz(b.client_name) || fuzz(b.title))
        .slice(0, 3),
    };
  }, [q, clients, payments, bookings]);

  const totalResults =
    results.clients.length + results.payments.length + results.bookings.length;

  function handleNavigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function clear() {
    setQuery("");
    // Keep dropdown open so the user can keep typing
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)] pointer-events-none" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search clients, invoices, bookings…"
          className="w-full h-10 pl-10 pr-9 rounded-full bg-white border border-[var(--color-border)] text-sm placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-2 focus:ring-[var(--color-primary)]/10 transition-colors"
        />
        {query && (
          <button
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--color-border-light)]"
          >
            <X className="h-3.5 w-3.5 text-[var(--color-muted)]" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && q && (
        <div className="absolute top-12 left-0 right-0 z-40 bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-soft-lg overflow-hidden max-h-[480px] overflow-y-auto">
          {totalResults === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
              No results for <span className="font-semibold text-[var(--color-ink)]">&ldquo;{query}&rdquo;</span>
            </div>
          ) : (
            <>
              {/* Clients */}
              {results.clients.length > 0 && (
                <ResultGroup label="Clients">
                  {results.clients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate(`/clients/${c.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-canvas)] transition-colors text-left"
                    >
                      <Avatar name={c.name} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{c.name}</div>
                        <div className="text-xs text-[var(--color-muted)] truncate">{c.phone}</div>
                      </div>
                      {c.outstanding_balance > 0 && (
                        <span className="text-xs font-bold text-[var(--color-danger-deep)] flex-shrink-0">
                          {formatCurrency(c.outstanding_balance)}
                        </span>
                      )}
                    </button>
                  ))}
                </ResultGroup>
              )}

              {/* Invoices */}
              {results.payments.length > 0 && (
                <ResultGroup label="Invoices">
                  {results.payments.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleNavigate(`/payments/${p.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-canvas)] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                        <Receipt className="h-4 w-4 text-[var(--color-primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {p.invoice_number ?? "Invoice"} · {p.client_name}
                        </div>
                        <div className="text-xs text-[var(--color-muted)] capitalize">{p.status}</div>
                      </div>
                      <span className="text-sm font-bold flex-shrink-0">{formatCurrency(p.amount)}</span>
                    </button>
                  ))}
                </ResultGroup>
              )}

              {/* Bookings */}
              {results.bookings.length > 0 && (
                <ResultGroup label="Bookings">
                  {results.bookings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => handleNavigate(`/clients/${b.client_id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-canvas)] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-info-light)] flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4 w-4 text-[var(--color-info)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{b.title}</div>
                        <div className="text-xs text-[var(--color-muted)] truncate">{b.client_name}</div>
                      </div>
                    </button>
                  ))}
                </ResultGroup>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-canvas)]/60">
        {label}
      </div>
      <div className="divide-y divide-[var(--color-border)]/40">{children}</div>
    </div>
  );
}
