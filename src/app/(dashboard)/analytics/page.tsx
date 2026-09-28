"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Minus, Lock, Sparkles, AlertTriangle, CheckCircle2, Info,
  Wallet, Receipt, Percent, Users, CalendarDays, Clock, type LucideIcon,
} from "lucide-react";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { TrendChart, ColumnChart, ShareRow, StackedBar, AGING_COLORS } from "@/components/analytics/Charts";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useBookings } from "@/hooks/useBookings";
import { useCurrency } from "@/hooks/useCurrency";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import {
  PERIODS, type PeriodKey, type Highlight,
  moneyStats, monthlyTrend, receivables, clientStats, bookingStats, serviceStats,
  highlights, pctChange, UNLINKED,
} from "@/lib/analytics/compute";

/**
 * Insights - business analytics for the selected period, each figure
 * compared with the period just before it. Free accounts see the headline
 * numbers; the deeper breakdowns are Pro.
 */
export default function AnalyticsPage() {
  const { isPro } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("90d");
  const { data: clients = [], isLoading: cl } = useClients();
  const { data: payments = [], isLoading: pl } = usePayments();
  const { data: bookings = [], isLoading: bl } = useBookings();
  const { format, symbol, country } = useCurrency();
  const loading = cl || pl || bl;

  const p = PERIODS.find((x) => x.key === period)!;
  const compact = useMemo(() => {
    const nf = new Intl.NumberFormat(country.locale, { notation: "compact", maximumFractionDigits: 1 });
    return (n: number) => `${symbol}${nf.format(n)}`;
  }, [country.locale, symbol]);

  const money = useMemo(() => moneyStats(payments, p.days), [payments, p.days]);
  const trend = useMemo(() => monthlyTrend(payments, period === "30d" ? 6 : 12), [payments, period]);
  const recv = useMemo(() => receivables(payments), [payments]);
  const cstats = useMemo(() => clientStats(clients, payments, bookings, p.days), [clients, payments, bookings, p.days]);
  const bstats = useMemo(() => bookingStats(bookings, p.days), [bookings, p.days]);
  const services = useMemo(() => serviceStats(payments, bookings, p.days), [payments, bookings, p.days]);
  const notes = useMemo(
    () => highlights(money, recv, cstats, bstats, p.label, format),
    [money, recv, cstats, bstats, p.label, format],
  );

  const upsell = () => setPaywallOpen(true);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header + period picker */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-page font-bold">Insights</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">
            How your business is doing, compared with the previous {p.label}.
          </p>
        </div>
        <div className="inline-flex self-start sm:self-auto p-1 rounded-full bg-white border border-[var(--color-border)]" role="tablist">
          {PERIODS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={period === x.key}
              onClick={() => setPeriod(x.key)}
              className={cn(
                "px-3.5 sm:px-4 py-1.5 rounded-full text-small font-semibold whitespace-nowrap transition-colors",
                period === x.key ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink-light)] hover:text-[var(--color-ink)]",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-32 rounded-[var(--radius-2xl)] skeleton" />)}
        </div>
      ) : (
        <>
          {/* Highlights */}
          {isPro && notes.length > 0 && <Highlights items={notes} />}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            <Kpi icon={Wallet} label="Revenue collected" value={format(money.collected)}
              delta={pctChange(money.collected, money.collectedPrev)} />
            <Kpi icon={Users} label="New clients" value={String(cstats.newInPeriod)}
              delta={pctChange(cstats.newInPeriod, cstats.newPrev)} />
            <Kpi icon={CalendarDays} label="Bookings" value={String(bstats.total)}
              delta={pctChange(bstats.total, bstats.totalPrev)} />
            {isPro ? (
              <>
                <Kpi icon={Receipt} label="Invoiced" value={format(money.invoiced)}
                  delta={pctChange(money.invoiced, money.invoicedPrev)}
                  hint={`${money.invoiceCount} invoice${money.invoiceCount === 1 ? "" : "s"}`} />
                <Kpi icon={Percent} label="Collection rate"
                  value={money.collectionRate === null ? "-" : `${money.collectionRate}%`}
                  hint="Of this period's invoices" />
                <Kpi icon={Clock} label="Avg. days to get paid"
                  value={money.avgDaysToPay === null ? "-" : String(money.avgDaysToPay)}
                  hint={`Avg. invoice ${format(Math.round(money.avgInvoice))}`} />
              </>
            ) : (
              <LockedTile onUnlock={upsell} />
            )}
          </div>

          {isPro ? (
            <>
              {/* Revenue trend */}
              <Card title="Revenue trend" sub="Money collected vs. invoiced each month">
                <TrendChart data={trend} format={format} compact={compact} />
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                {/* Receivables */}
                <Card title="Money owed to you" sub={`${format(recv.outstanding)} outstanding · ${format(recv.overdue)} overdue`}>
                  {recv.outstanding <= 0 ? (
                    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-success-light)] px-4 py-3.5 text-small text-[var(--color-success-deep)]">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      Nothing owed right now - every invoice is paid.
                    </div>
                  ) : (<>
                  <StackedBar parts={recv.buckets.map((b) => ({ amount: b.amount, color: AGING_COLORS[b.tone], label: b.label }))} />
                  <ul className="mt-4 space-y-2">
                    {recv.buckets.map((b) => (
                      <li key={b.label} className="flex items-center justify-between gap-3 text-small">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: AGING_COLORS[b.tone] }} />
                          <span className="text-[var(--color-ink-mid)] truncate">{b.label}</span>
                          {b.count > 0 && <span className="text-tiny text-[var(--color-muted)]">({b.count})</span>}
                        </span>
                        <span className="font-semibold tabular-nums whitespace-nowrap">{format(b.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  {recv.topDebtors.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
                      <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">Owes you the most</div>
                      {recv.topDebtors.map((d) => (
                        <ShareRow key={d.clientId} label={d.name} value={format(d.amount)}
                          pct={(d.amount / recv.outstanding) * 100}
                          color={d.oldestDays > 30 ? AGING_COLORS.worst : d.oldestDays > 0 ? AGING_COLORS.warn : AGING_COLORS.ok}
                          sub={d.oldestDays > 0 ? `Oldest invoice ${d.oldestDays} days late` : "Not yet due"}
                          href={`/clients/${d.clientId}`} />
                      ))}
                    </div>
                  )}
                  </>)}
                </Card>

                {/* Services */}
                <Card title="Services" sub={`What earned the most in the last ${p.label}`}>
                  {services.length === 0 ? (
                    <Empty text="No bookings or payments in this period yet." />
                  ) : (
                    services.slice(0, 6).map((s) => {
                      const top = services[0].revenue || 1;
                      return (
                        <ShareRow key={s.name} label={s.name} value={format(Math.round(s.revenue))}
                          pct={(s.revenue / top) * 100}
                          sub={s.name === UNLINKED
                            ? "Add line items or create invoices from bookings to see which service these were for"
                            : `${s.bookings} booking${s.bookings === 1 ? "" : "s"}${s.bookings && s.revenue ? ` · ${format(Math.round(s.revenue / s.bookings))} per booking` : ""}`} />
                      );
                    })
                  )}
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                {/* Top clients */}
                <Card title="Top clients" sub="All-time revenue and share of your total">
                  {cstats.topClients.length === 0 ? (
                    <Empty text="Once clients pay you, your best customers show up here." />
                  ) : (
                    <ul className="divide-y divide-[var(--color-border)]">
                      {cstats.topClients.map((c, i) => (
                        <li key={c.id}>
                          <Link href={`/clients/${c.id}`} className="flex items-center gap-3 py-3 hover:opacity-80 transition-opacity">
                            <span className="w-5 text-tiny font-bold text-[var(--color-muted)] tabular-nums">{i + 1}</span>
                            <Avatar name={c.name} size={34} />
                            <div className="flex-1 min-w-0">
                              <div className="text-small font-semibold truncate">{c.name}</div>
                              <div className="text-tiny text-[var(--color-muted)]">
                                {c.share}% of revenue{c.visits ? ` · ${c.visits} visit${c.visits === 1 ? "" : "s"}` : ""}
                              </div>
                            </div>
                            <span className="text-small font-bold tabular-nums whitespace-nowrap text-[var(--color-success-deep)]">
                              {format(c.revenue)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                {/* Client health */}
                <Card title="Client health" sub="Loyalty and who's drifting away">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <MiniStat label="Repeat clients" value={cstats.repeatRate === null ? "-" : `${cstats.repeatRate}%`} />
                    <MiniStat label="Avg. value" value={compact(Math.round(cstats.avgLifetimeValue))} title={format(Math.round(cstats.avgLifetimeValue))} />
                    <MiniStat label="Top 3 share" value={cstats.top3Share === null ? "-" : `${cstats.top3Share}%`} />
                  </div>
                  <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
                    <div className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">
                      Haven&apos;t been back in 60+ days
                    </div>
                    {cstats.atRisk.length === 0 ? (
                      <p className="text-small text-[var(--color-ink-light)]">Nobody - your paying clients are all active.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {cstats.atRisk.map((c) => (
                          <li key={c.id}>
                            <Link href={`/clients/${c.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                              <Avatar name={c.name} size={30} />
                              <span className="flex-1 min-w-0 text-small font-semibold truncate">{c.name}</span>
                              <span className="text-tiny text-[var(--color-muted)] whitespace-nowrap">{c.lastSeenDays} days ago</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                <Card
                  title="Busiest days"
                  sub={bstats.total
                    ? `${bstats.completionRate}% attended · ${bstats.cancellationRate}% cancelled · ${bstats.upcoming} upcoming`
                    : `${bstats.upcoming} upcoming`}
                >
                  <ColumnChart
                    data={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => ({
                      label: d, short: d.slice(0, 3), value: bstats.byWeekday[i],
                    }))}
                  />
                </Card>
                <Card title="Busiest hours" sub="When your appointments start">
                  <ColumnChart
                    data={Array.from({ length: 15 }, (_, k) => k + 7).map((h) => ({
                      label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`,
                      short: h % 3 === 1 ? `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}` : "",
                      value: bstats.byHour[h],
                    }))}
                  />
                </Card>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6 sm:p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-5 w-5 text-[var(--color-primary)]" />
              </div>
              <h3 className="text-card-title font-semibold text-[var(--color-ink)] mb-2">
                See the full picture of your business
              </h3>
              <p className="text-small text-[var(--color-ink-light)] max-w-md mx-auto mb-5">
                Revenue trends, who owes you and for how long, your best clients and services,
                clients drifting away, and your busiest days and hours.
              </p>
              <Button leftIcon={<Sparkles className="h-4 w-4" />} onClick={upsell}>
                Unlock with Pro
              </Button>
            </div>
          )}
        </>
      )}

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7 min-w-0">
      <h2 className="text-card-title font-semibold text-[var(--color-ink)]">{title}</h2>
      {sub && <p className="text-small text-[var(--color-muted)] mt-1">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Kpi({
  icon: Icon, label, value, delta, hint,
}: { icon: LucideIcon; label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-4 sm:p-6 min-w-0">
      <div className="flex items-center gap-2 text-[var(--color-muted)]">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-tiny font-semibold uppercase tracking-wider leading-snug">{label}</span>
      </div>
      <div className="mt-3 text-[1.375rem] sm:text-stat leading-tight font-bold text-[var(--color-ink)] tabular-nums truncate" title={value}>
        {value}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[20px]">
        {delta !== undefined && <Delta value={delta} />}
        {hint && <span className="text-tiny text-[var(--color-muted)]">{hint}</span>}
      </div>
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-tiny text-[var(--color-muted)]">No earlier data</span>;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-tiny font-bold tabular-nums",
        value > 0 && "bg-[var(--color-success-light)] text-[var(--color-success-deep)]",
        value < 0 && "bg-[var(--color-danger-light)] text-[var(--color-danger-deep)]",
        value === 0 && "bg-[var(--color-border-light)] text-[var(--color-ink-light)]",
      )}
    >
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}{value}%
    </span>
  );
}

function MiniStat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-canvas)] px-3 py-3 min-w-0">
      <div className="text-lead font-bold tabular-nums truncate" title={title ?? value}>{value}</div>
      <div className="text-tiny text-[var(--color-muted)] mt-0.5 leading-snug">{label}</div>
    </div>
  );
}

function Highlights({ items }: { items: Highlight[] }) {
  const icon = { good: CheckCircle2, warn: AlertTriangle, info: Info } as const;
  const color = {
    good: "text-[var(--color-success-deep)]",
    warn: "text-[var(--color-warning-deep)]",
    info: "text-[var(--color-info)]",
  } as const;
  return (
    <section className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
      <h2 className="text-card-title font-semibold text-[var(--color-ink)] flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--color-primary)]" /> Highlights
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((h, i) => {
          const Icon = icon[h.tone];
          return (
            <li key={i} className="flex items-start gap-3 text-small text-[var(--color-ink-mid)] leading-relaxed">
              <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", color[h.tone])} />
              <span>{h.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LockedTile({ onUnlock }: { onUnlock: () => void }) {
  return (
    <button
      onClick={onUnlock}
      // Fills the empty slot beside the 3rd KPI on phones; its own row on desktop.
      className="lg:col-span-3 bg-[var(--color-canvas)] rounded-[var(--radius-2xl)] border border-dashed border-[var(--color-border)] p-4 sm:p-6 text-left hover:border-[var(--color-primary)] transition-colors flex flex-col lg:flex-row lg:items-center justify-center gap-2 lg:gap-3"
    >
      <Lock className="h-4 w-4 text-[var(--color-muted)] flex-shrink-0" />
      <span className="text-small text-[var(--color-ink-light)] leading-snug">
        Invoiced, collection rate and days to get paid.{" "}
        <span className="font-semibold text-[var(--color-primary)] whitespace-nowrap">Unlock with Pro</span>
      </span>
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-small text-[var(--color-muted)] py-4 text-center">{text}</p>;
}
