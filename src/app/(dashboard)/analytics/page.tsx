"use client";

import { useMemo } from "react";
import { ProGate } from "@/components/paywall/ProGate";
import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useCurrency } from "@/hooks/useCurrency";
import { Avatar } from "@/components/ui/Avatar";
import { BarChart } from "@/components/analytics/BarChart";

export default function AnalyticsPage() {
  return (
    <ProGate
      title="Analytics+"
      description="Unlock revenue trends, top clients, collection rate and growth insights with Orbit Pro."
    >
      <AnalyticsContent />
    </ProGate>
  );
}

function AnalyticsContent() {
  const { data: clients = [] } = useClients();
  const { data: payments = [] } = usePayments();
  const { format: formatCurrency } = useCurrency();

  const revenue = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.paid_amount ?? p.amount), 0);
  const issued = payments.reduce((sum, p) => sum + p.amount, 0);
  const collectionRate = issued > 0 ? Math.round((revenue / issued) * 100) : 0;
  const activeClients = clients.filter((c) => c.status === "active").length;

  // Revenue per month (last 6 months)
  const monthlyRevenue = useMemo(() => {
    const buckets: { label: string; value: number; key: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        value: 0,
      });
    }
    payments
      .filter((p) => p.status === "paid")
      .forEach((p) => {
        const key = p.date.slice(0, 7);
        const bucket = buckets.find((b) => b.key === key);
        if (bucket) bucket.value += p.paid_amount ?? p.amount;
      });
    return buckets;
  }, [payments]);

  // Top 5 clients by revenue
  const topClients = useMemo(() => {
    return [...clients]
      .filter((c) => c.total_paid > 0)
      .sort((a, b) => b.total_paid - a.total_paid)
      .slice(0, 5);
  }, [clients]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page font-bold">Analytics</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">A clear picture of your business.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard label="Total Revenue"   value={formatCurrency(revenue)} icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard label="Collection Rate" value={`${collectionRate}%`}    icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Active Clients"  value={activeClients}           icon={<Users className="h-4 w-4" />} />
        <MetricCard label="Total Clients"   value={clients.length}          icon={<Users className="h-4 w-4" />} />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-card-title font-semibold">Revenue · last 6 months</h3>
            <p className="text-small text-[var(--color-muted)] mt-1">
              {formatCurrency(monthlyRevenue.reduce((s, m) => s + m.value, 0))} collected in this window
            </p>
          </div>
          <BarChart3 className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <BarChart data={monthlyRevenue} format={formatCurrency} />
      </div>

      {/* Top clients */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-[var(--color-border)]">
          <h3 className="text-card-title font-semibold">Top clients by revenue</h3>
        </div>
        {topClients.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--color-muted)]">
            No revenue logged yet - add a paid invoice to see top clients here.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {topClients.map((c, i) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-6 text-xs font-bold text-[var(--color-muted)]">#{i + 1}</span>
                <Avatar name={c.name} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                </div>
                <div className="text-sm font-bold text-[var(--color-success-deep)]">
                  {formatCurrency(c.total_paid)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7">
      <div className="flex items-center justify-between mb-5">
        <span className="text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</span>
        <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-stat font-bold">{value}</div>
    </div>
  );
}
