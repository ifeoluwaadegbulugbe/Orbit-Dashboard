"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Plus, TrendingUp, Lock, ChevronRight } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useSubscription } from "@/hooks/useSubscription";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import {
  FREE_CLIENT_LIMIT,
  CLIENT_LIMIT_WARNING_THRESHOLD,
} from "@/lib/constants";
import { relativeDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import type { ClientStatus } from "@/types";

type Filter = "all" | ClientStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "follow_up", label: "Follow up" },
  { key: "overdue", label: "Overdue" },
  { key: "inactive", label: "Inactive" },
];

const STATUS_TONE: Record<ClientStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  follow_up: "warning",
  overdue: "danger",
  inactive: "neutral",
};

const STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Active",
  follow_up: "Follow up",
  overdue: "Overdue",
  inactive: "Inactive",
};

export default function ClientsPage() {
  const { data: clients = [], isLoading } = useClients();
  const { isPro } = useSubscription();
  const { format: formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [paywallOpen, setPaywallOpen] = useState(false);

  const count = clients.length;
  const atLimit = !isPro && count >= FREE_CLIENT_LIMIT;
  const nearLimit = !isPro && count >= CLIENT_LIMIT_WARNING_THRESHOLD && count < FREE_CLIENT_LIMIT;

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        const matchSearch =
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search);
        const matchFilter = filter === "all" || c.status === filter;
        return matchSearch && matchFilter;
      }),
    [clients, search, filter],
  );

  function handleAddClick() {
    if (atLimit) {
      setPaywallOpen(true);
      return;
    }
    window.location.assign("/clients/new");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page font-bold text-[var(--color-ink)]">
            {count} {count === 1 ? "Person" : "People"}
            {!isPro && (
              <span className="ml-3 text-lead font-medium text-[var(--color-muted)]">
                {count}/{FREE_CLIENT_LIMIT}
              </span>
            )}
          </h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">
            Everyone you work with, in one place.
          </p>
        </div>
        <Button
          leftIcon={atLimit ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          onClick={handleAddClick}
          variant={atLimit ? "secondary" : "primary"}
        >
          {atLimit ? "Limit reached" : "Add client"}
        </Button>
      </div>

      {/* Growth banner */}
      {(nearLimit || atLimit) && (
        <button
          onClick={() => setPaywallOpen(true)}
          className="w-full flex items-center gap-4 px-6 py-5 bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20 rounded-[var(--radius-2xl)] text-left transition-all hover:shadow-soft hover:-translate-y-px"
        >
          <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            {atLimit ? (
              <Lock className="h-5 w-5 text-[var(--color-primary)]" />
            ) : (
              <TrendingUp className="h-5 w-5 text-[var(--color-primary)]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-body font-bold text-[var(--color-ink)]">
              {atLimit ? "You've reached your client limit" : "You're growing! 🌱"}
            </div>
            <div className="text-small text-[var(--color-ink-mid)] leading-relaxed mt-1">
              {atLimit
                ? "Upgrade to Pro for unlimited clients and automations."
                : `${FREE_CLIENT_LIMIT - count} ${FREE_CLIENT_LIMIT - count === 1 ? "spot" : "spots"} left on Free. Upgrade to Pro for unlimited clients and automations.`}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-[var(--color-primary)] flex-shrink-0" />
        </button>
      )}

      {/* Search + filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full h-11 pl-10 pr-4 rounded-full bg-white border border-[var(--color-border)] text-sm placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]/40 focus:ring-2 focus:ring-[var(--color-primary)]/10 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === f.key
                  ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary-dark)]"
                  : "bg-white border-[var(--color-border)] text-[var(--color-ink-light)] hover:border-[var(--color-primary)]/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-[var(--radius-xl)] skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {search ? "No clients found." : "No clients yet - tap Add client to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center gap-5 px-6 py-5 bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm hover:shadow-soft hover:-translate-y-px transition-all"
            >
              <Avatar name={c.name} size={52} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-body font-semibold text-[var(--color-ink)] truncate">
                    {c.name}
                  </span>
                  {c.outstanding_balance > 0 && (
                    <span className="text-small font-bold text-[var(--color-danger-deep)]">
                      {formatCurrency(c.outstanding_balance)} owed
                    </span>
                  )}
                </div>
                <div className="text-small text-[var(--color-muted)] mt-1">{c.phone}</div>
                <div className="flex items-center gap-3 mt-2.5">
                  <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                  <span className="text-tiny text-[var(--color-muted)]">
                    Last: {c.last_contacted ? relativeDate(c.last_contacted) : "never"}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[var(--color-muted)]" />
            </Link>
          ))}
        </div>
      )}

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        reason={atLimit ? "You've hit the 10-client limit" : undefined}
      />
    </div>
  );
}
