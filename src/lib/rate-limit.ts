/**
 * Simple per-key rate limits backed by the rate_limit_hits table
 * (migration 024). Fails open if the table isn't there, so a missing
 * migration never takes a feature down - it just isn't limited.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export interface Limit { max: number; windowMs: number }

/**
 * Records a hit for each bucket and reports whether ANY bucket is over its
 * limit (checked before recording, so a blocked request doesn't count).
 */
export async function overLimit(buckets: [bucket: string, limit: Limit][]): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    for (const [bucket, { max, windowMs }] of buckets) {
      const since = new Date(Date.now() - windowMs).toISOString();
      const { count, error } = await supabase
        .from("rate_limit_hits").select("id", { count: "exact", head: true })
        .eq("bucket", bucket).gte("created_at", since);
      if (error) return false;
      if ((count ?? 0) >= max) return true;
    }
    await supabase.from("rate_limit_hits").insert(buckets.map(([bucket]) => ({ bucket })));
    return false;
  } catch {
    return false;
  }
}

/** The caller's IP as Vercel reports it. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
