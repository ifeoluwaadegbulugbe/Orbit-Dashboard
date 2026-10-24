"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Users, UserPlus, Activity, CalendarDays, CalendarRange, Rocket, RefreshCw, Search,
  ArrowUpDown, ShieldCheck, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { TrendChart, ColumnChart, ShareRow } from "@/components/analytics/Charts";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { EVENTS, type EventName } from "@/lib/analytics/catalog";
import type { AdminAnalytics as Data, Segment, Tier, UserStatus } from "@/lib/analytics/admin-metrics";
import { ymdInZone } from "@/lib/time/ymd";

const PRESETS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "1 year", days: 365 },
] as const;

const todayKey = () => ymdInZone(new Date(), "Africa/Lagos");
const minusDays = (k: string, n: number) => new Date(Date.parse(`${k}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const nf = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 });
const n = (v: number) => nf.format(v);
const pctText = (v: number | null) => (v === null ? "-" : `${nf.format(v)}%`);

type SortKey = "name" | "createdAt" | "lastActiveAt" | "actionsInPeriod";

export function AdminAnalytics() {
  const [preset, setPreset] = useState<string>("30");
  const [to, setTo] = useState(todayKey);
  const [from, setFrom] = useState(() => minusDays(todayKey(), 29));
  const [tier, setTier] = useState<Tier | "all">("all");
  const [segment, setSegment] = useState<Segment>("all");
  const [event, setEvent] = useState<EventName | "all">("all");

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Deliberately not React Query: that cache is persisted to localStorage,
  // and internal analytics shouldn't sit on the device.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to, tier, segment, event });
      const res = await fetch(`/api/admin/analytics?${qs}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setData(json as Data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load analytics.");
    } finally {
      setLoading(false);
    }
  }, [from, to, tier, segment, event]);

  useEffect(() => { void load(); }, [load]);

  function pickPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key);
    setPreset(key);
    if (!p) return;
    const t = todayKey();
    setTo(t);
    setFrom(minusDays(t, p.days - 1));
  }

  const eventOptions = useMemo(
    () => (Object.keys(EVENTS) as EventName[]).map((e) => ({ value: e, label: EVENTS[e].label })).sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-deep,var(--color-primary))] text-tiny font-semibold uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> Internal · admins only
          </div>
          <h1 className="text-page font-bold mt-3">Product analytics</h1>
          <p className="text-lead text-[var(--color-ink-light)] mt-2">
            Who actively uses Orbit, what they do, where they stop, and whether they come back.
          </p>
        </div>
        <div className="flex w-full lg:w-auto p-1 rounded-full bg-white border border-[var(--color-border)]" role="tablist">
          {PRESETS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={preset === x.key}
              onClick={() => pickPreset(x.key)}
              className={cn(
                "flex-1 lg:flex-none px-2 sm:px-4 py-1.5 rounded-full text-small font-semibold whitespace-nowrap transition-colors",
                preset === x.key ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink-light)] hover:text-[var(--color-ink)]",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Field label="From">
          <input type="date" value={from} max={to} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className={inputCls} />
        </Field>
        <Field label="To">
          <input type="date" value={to} min={from} max={todayKey()} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className={inputCls} />
        </Field>
        <Field label="Plan">
          <select value={tier} onChange={(e) => setTier(e.target.value as Tier | "all")} className={inputCls}>
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="trial">Pro trial</option>
            <option value="pro">Pro</option>
          </select>
        </Field>
        <Field label="Users">
          <select value={segment} onChange={(e) => setSegment(e.target.value as Segment)} className={inputCls}>
            <option value="all">All users</option>
            <option value="new">New (joined in range)</option>
            <option value="returning">Returning</option>
          </select>
        </Field>
        <Field label="Activity" className="col-span-2 lg:col-span-1">
          <select value={event} onChange={(e) => setEvent(e.target.value as EventName | "all")} className={inputCls}>
            <option value="all">All meaningful actions</option>
            {eventOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      {error ? (
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6 sm:p-10 text-center">
          <AlertTriangle className="h-6 w-6 mx-auto text-[var(--color-warning-deep)]" />
          <p className="mt-3 text-body font-semibold">{error}</p>
          <div className="mt-5 inline-flex"><Button onClick={load} leftIcon={<RefreshCw className="h-4 w-4" />}>Try again</Button></div>
        </div>
      ) : loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 rounded-[var(--radius-2xl)] skeleton" />)}
        </div>
      ) : data ? (
        <div className={cn("space-y-6 sm:space-y-8 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <Overview data={data} />
          {data.overview.totalUsers === 0 ? (
            <Empty text="No accounts match these filters yet." />
          ) : (
            <>
              <Charts data={data} />
              <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">
                <Adoption data={data} />
                <Funnel data={data} />
              </div>
              <FeatureUsage data={data} />
              <UsersTable data={data} />
            </>
          )}
          <Definitions data={data} />
        </div>
      ) : null}
    </div>
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────

function Overview({ data }: { data: Data }) {
  const o = data.overview;
  const r = o.weekOneRetention;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
      <Kpi icon={Users} label="Registered users" value={n(o.totalUsers)} hint="Excludes team & test accounts" />
      <Kpi icon={UserPlus} label="New signups" value={n(o.newSignups)} hint="In the selected range" />
      <Kpi icon={Activity} label="Daily active" value={n(o.dau)} hint={`On ${fmtDay(data.range.to)}`} />
      <Kpi icon={CalendarDays} label="Weekly active" value={n(o.wau)} hint="7 days to the end date" />
      <Kpi icon={CalendarRange} label="Monthly active" value={n(o.mau)} hint="30 days to the end date" />
      <Kpi icon={Rocket} label="Activation rate" value={pctText(o.activation.pct)}
        hint={o.activation.cohort ? `${o.activation.activated} of ${o.activation.cohort} new signups` : "No signups in range"} />
      <Kpi icon={RefreshCw} label="Week-1 retention" value={pctText(r.pct)}
        hint={r.pct === null
          ? `Needs ${r.minCohort}+ signups at least 14 days old in range (${r.cohort} so far)`
          : `${r.retained} of ${r.cohort} came back in week 2`} />
      <Kpi icon={Activity} label="Active in range" value={n(data.adoptionBase)} hint="Did a meaningful action" />
    </div>
  );
}

function Charts({ data }: { data: Data }) {
  const weekly = data.range.bucket === "week";
  const every = Math.max(1, Math.ceil(data.series.length / 6));
  const short = (s: Data["series"][number], i: number) => (i % every === 0 ? fmtShort(s.start) : "");
  const label = (s: Data["series"][number]) => (weekly ? `Week of ${fmtDay(s.start)}` : fmtDay(s.start));
  const count = (v: number) => n(v);

  return (
    <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">
      <Card title="Signups over time" sub={weekly ? "Per week" : "Per day"}>
        <ColumnChart unit="signup" emptyText="No signups in this range" highlightMax={false}
          data={data.series.map((s, i) => ({ label: label(s), value: s.signups, short: short(s, i) }))} />
      </Card>
      <Card title="Daily & weekly active users" sub={weekly ? "DAU = average per day that week; WAU = 7 days to week end" : "WAU = unique users over the 7 days to each date"}>
        <TrendChart format={count} compact={count} labels={{ collected: "DAU", invoiced: "WAU" }}
          data={data.series.map((s, i) => ({ label: label(s), collected: s.dau, invoiced: s.wau, short: short(s, i) }))} />
      </Card>
      <Card title={data.activityDefinition.filteredTo ? `${EVENTS[data.activityDefinition.filteredTo].label} over time` : "Meaningful actions over time"}>
        <ColumnChart unit="action" emptyText="No actions in this range" highlightMax={false}
          data={data.series.map((s, i) => ({ label: label(s), value: s.actions, short: short(s, i) }))} />
      </Card>
      <Card title="New vs returning active users" sub={`New = signed up within ${data.thresholds.newUserDays} days`}>
        <TrendChart format={count} compact={count} labels={{ collected: "New", invoiced: "Returning" }}
          data={data.series.map((s, i) => ({ label: label(s), collected: s.newActive, invoiced: s.returningActive, short: short(s, i) }))} />
      </Card>
    </div>
  );
}

function Adoption({ data }: { data: Data }) {
  return (
    <Card title="Feature adoption" sub={`Unique users in range, as a share of the ${n(data.adoptionBase)} active users`}>
      {data.adoptionBase === 0 ? <Empty text="Nobody was active in this range." small /> : (
        <div className="divide-y divide-[var(--color-border-light)]">
          {data.adoption.map((a) => (
            <ShareRow key={a.label} label={a.label} value={`${n(a.users)} · ${pctText(a.pct)}`} pct={a.pct ?? 0} />
          ))}
        </div>
      )}
    </Card>
  );
}

function Funnel({ data }: { data: Data }) {
  const start = data.funnel[0]?.users ?? 0;
  return (
    <Card title="Activation funnel" sub="Signups in range. Each step needs the ones before it, in any order.">
      {start === 0 ? <Empty text="No signups in this range." small /> : (
        <ol className="space-y-3">
          {data.funnel.map((f, i) => (
            <li key={f.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-small font-semibold text-[var(--color-ink)] min-w-0 truncate">{i + 1}. {f.label}</span>
                <span className="text-small font-bold tabular-nums whitespace-nowrap">{n(f.users)} · {pctText(f.pct)}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-[var(--color-border-light)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.max(2, f.pct ?? 0)}%` }} />
              </div>
              {i > 0 && f.lost > 0 && <div className="mt-1 text-tiny text-[var(--color-muted)]">{n(f.lost)} stopped here</div>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function FeatureUsage({ data }: { data: Data }) {
  const max = Math.max(1, ...data.featureUsage.map((f) => f.count));
  return (
    <Card title="Feature usage by event" sub="Every tracked event in range: total times, and how many accounts">
      {data.featureUsage.length === 0 ? <Empty text="No events in this range." small /> : (
        <div className="grid sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 divide-[var(--color-border-light)]">
          {data.featureUsage.map((f) => (
            <ShareRow key={f.key} label={f.label} value={`${n(f.count)} · ${n(f.users)} user${f.users === 1 ? "" : "s"}`} pct={(f.count / max) * 100} />
          ))}
        </div>
      )}
    </Card>
  );
}

function UsersTable({ data }: { data: Data }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "lastActiveAt", dir: -1 });

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return data.users
      .filter((u) => (status === "all" || u.status === status) && (!query || u.name.toLowerCase().includes(query)))
      .sort((a, b) => {
        const av = a[sort.key] ?? "", bv = b[sort.key] ?? "";
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
  }, [data.users, q, status, sort]);

  const th = (key: SortKey, label: string, cls = "") => (
    <th className={cn("px-3 py-2.5 font-semibold", cls)}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}
        className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]" aria-label={`Sort by ${label}`}>
        {label}<ArrowUpDown className={cn("h-3 w-3", sort.key === key ? "opacity-100" : "opacity-40")} />
      </button>
    </th>
  );

  return (
    <Card title="Accounts" sub={`Inactive = no meaningful action for ${data.thresholds.inactiveAfterDays} days. New = signed up within ${data.thresholds.newUserDays} days.`}>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="flex items-center gap-2 h-11 px-3 flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white focus-within:border-[var(--color-primary)]">
          <Search className="h-4 w-4 text-[var(--color-muted)] flex-shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business or name" aria-label="Search accounts"
            className="flex-1 min-w-0 bg-transparent text-body outline-none" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | "all")} className={cn(inputCls, "sm:w-48")} aria-label="Activity status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="new">New</option>
        </select>
      </div>
      {rows.length === 0 ? <Empty text="No accounts match." small /> : (
        <div className="-mx-5 sm:mx-0 overflow-x-auto">
          <table className="w-full min-w-[760px] text-small">
            <thead className="text-left text-tiny uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <tr>
                {th("name", "Account", "pl-5 sm:pl-3")}
                {th("createdAt", "Joined")}
                {th("lastActiveAt", "Last active")}
                {th("actionsInPeriod", "Actions")}
                <th className="px-3 py-2.5 font-semibold">Last feature</th>
                <th className="px-3 py-2.5 font-semibold">Plan</th>
                <th className="px-3 py-2.5 font-semibold">Activated</th>
                <th className="px-3 py-2.5 font-semibold pr-5 sm:pr-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-3 pl-5 sm:pl-3 font-semibold text-[var(--color-ink)] max-w-[220px] truncate" title={u.name}>{u.name}</td>
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">{fmtDay(u.createdAt)}</td>
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">{u.lastActiveAt ? fmtDay(u.lastActiveAt) : <span className="text-[var(--color-muted)]">Never</span>}</td>
                  <td className="px-3 py-3 tabular-nums">{n(u.actionsInPeriod)}</td>
                  <td className="px-3 py-3 max-w-[180px] truncate" title={u.lastFeature ?? ""}>{u.lastFeature ?? "-"}</td>
                  <td className="px-3 py-3 capitalize">{u.tier === "trial" ? "Pro trial" : u.tier}</td>
                  <td className="px-3 py-3">{u.activated ? "Yes" : <span className="text-[var(--color-muted)]">Not yet</span>}</td>
                  <td className="px-3 py-3 pr-5 sm:pr-3"><StatusPill status={u.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-tiny text-[var(--color-muted)]">{n(rows.length)} of {n(data.users.length)} accounts</p>
    </Card>
  );
}

function Definitions({ data }: { data: Data }) {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-dashed border-[var(--color-border)] p-5 sm:p-6 text-small text-[var(--color-ink-light)] leading-relaxed">
      <h2 className="font-semibold text-[var(--color-ink)]">How these numbers are counted</h2>
      <p className="mt-2">
        <strong>Active</strong> = the business owner did at least one of: {data.activityDefinition.events.map((e) => e.label.toLowerCase()).join(", ")}.
        Logging in, opening pages, notifications, customer bookings and automatic emails don&apos;t count.
      </p>
      <p className="mt-2">
        Days are calendar days in {data.range.timeZone}. Activity before analytics launched comes from Orbit&apos;s own records
        (clients, bookings, invoices, reminders), so older history only includes those actions. Team and test accounts are excluded.
      </p>
    </section>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

const inputCls = "w-full h-11 px-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white text-small text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)]";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="block text-tiny font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7 min-w-0">
      <h2 className="text-card-title font-semibold text-[var(--color-ink)]">{title}</h2>
      {sub && <p className="text-small text-[var(--color-muted)] mt-1">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-4 sm:p-6 min-w-0">
      <div className="flex items-center gap-2 text-[var(--color-muted)]">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-tiny font-semibold uppercase tracking-wider leading-snug">{label}</span>
      </div>
      <div className="mt-3 text-[1.375rem] sm:text-stat leading-tight font-bold text-[var(--color-ink)] tabular-nums truncate" title={value}>{value}</div>
      {hint && <div className="mt-2 text-tiny text-[var(--color-muted)] leading-snug">{hint}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: UserStatus }) {
  const styles = {
    active: "bg-[var(--color-success-light)] text-[var(--color-success-deep)]",
    inactive: "bg-[var(--color-border-light)] text-[var(--color-ink-light)]",
    new: "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]",
  } as const;
  return <span className={cn("inline-flex px-2 py-0.5 rounded-full text-tiny font-semibold capitalize", styles[status])}>{status}</span>;
}

function Empty({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className={cn("text-center text-small text-[var(--color-muted)]", small ? "py-6" : "bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] p-10")}>
      {text}
    </div>
  );
}

function fmtDay(iso: string) {
  try { return format(iso.length === 10 ? parseISO(iso) : new Date(iso), "d MMM yyyy"); } catch { return iso; }
}
function fmtShort(day: string) {
  try { return format(parseISO(day), "d MMM"); } catch { return day; }
}
