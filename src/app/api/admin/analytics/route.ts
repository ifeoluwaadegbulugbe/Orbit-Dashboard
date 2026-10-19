import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminUser, isInternalAccount } from "@/lib/admin";
import { computeAdminAnalytics, dayKey, type AccountRow, type EventRow, type Segment, type Tier } from "@/lib/analytics/admin-metrics";
import { ANALYTICS_TIMEZONE, isEventName } from "@/lib/analytics/catalog";

/**
 * GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&tier=&segment=&event=
 *
 * Admins only (checked here, server-side, on every request - see
 * src/lib/admin.ts). Everyone else gets a 404, so the endpoint doesn't
 * even confirm it exists. Returns aggregates plus a per-account activity
 * list (name, dates, counts) - never client records, messages, emails or
 * payment details.
 */
export const dynamic = "force-dynamic";

const CACHE_MS = 60_000;
let cache: { at: number; accounts: AccountRow[]; events: EventRow[] } | null = null;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 500; page++) {
    const { data, error } = await build(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function load(): Promise<{ accounts: AccountRow[]; events: EventRow[] }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const supabase = createServiceClient();
  const [profiles, rawEvents] = await Promise.all([
    fetchAll<AccountRow & { email: string | null }>((a, b) =>
      supabase.from("profiles").select("id, email, full_name, business_name, created_at, subscription_status, trial_ends_at").order("id").range(a, b)),
    fetchAll<EventRow>((a, b) =>
      supabase.from("user_product_events").select("user_id, event, actor, created_at").order("id").range(a, b)),
  ]);
  // Keep the team's own and test accounts out of the numbers.
  const accounts = profiles.filter((p) => !isInternalAccount(p)).map(({ email: _email, ...rest }) => rest);
  cache = { at: Date.now(), accounts, events: rawEvents };
  return cache;
}

const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const q = new URL(request.url).searchParams;
  const today = dayKey(new Date(), ANALYTICS_TIMEZONE);
  const to = isDay(q.get("to")) ? q.get("to")! : today;
  const fallbackFrom = new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  let from = isDay(q.get("from")) ? q.get("from")! : fallbackFrom;
  if (from > to) from = to;
  // At most two years per request.
  const earliest = new Date(Date.parse(`${to}T00:00:00Z`) - 730 * 86_400_000).toISOString().slice(0, 10);
  if (from < earliest) from = earliest;

  const tier = (["free", "trial", "pro"] as const).includes(q.get("tier") as Tier) ? (q.get("tier") as Tier) : "all";
  const segment = (["new", "returning"] as string[]).includes(q.get("segment") ?? "") ? (q.get("segment") as Segment) : "all";
  const ev = q.get("event");
  const event = isEventName(ev) ? ev : "all";

  try {
    const { accounts, events } = await load();
    const result = computeAdminAnalytics(accounts, events, { from, to, tier, segment, event });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[admin-analytics] failed:", err);
    return NextResponse.json({ error: "Couldn't load analytics. Try again in a minute." }, { status: 500 });
  }
}
