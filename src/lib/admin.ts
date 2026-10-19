/**
 * Who may see Orbit's internal admin pages (product analytics).
 *
 * Checked on the server only, against the session Supabase verifies - never
 * a client-side flag. An admin is either:
 *   - the existing owner account(s) in ADMIN_EMAILS (src/lib/subscription/isPro.ts), or
 *   - a user id listed in ORBIT_ADMIN_USER_IDS (comma-separated).
 *
 * Extra admins are added by user ID, not email, on purpose: Orbit's signup
 * doesn't verify inbox ownership, so an email that isn't registered yet
 * could be claimed by anyone. The owner emails above are already
 * registered accounts, so they can't be.
 */

import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/subscription/isPro";

function adminIds(): Set<string> {
  return new Set((process.env.ORBIT_ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

export function isAdminUser(user: Pick<User, "id" | "email"> | null | undefined): boolean {
  if (!user) return false;
  if (adminIds().has(user.id)) return true;
  return !!user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/** The signed-in admin, or null for everyone else (signed out included). */
export async function getAdminUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return isAdminUser(user) ? user : null;
  } catch {
    return null;
  }
}

/** Accounts kept out of analytics: admins and reserved test addresses, plus ANALYTICS_EXCLUDE_EMAILS. */
export function isInternalAccount(p: { id: string; email?: string | null }): boolean {
  if (isAdminUser({ id: p.id, email: p.email ?? undefined })) return true;
  const email = (p.email ?? "").toLowerCase();
  if (/@(example\.(com|org|net)|[^@]+\.(test|invalid|example|localhost))$/.test(email)) return true;
  const extra = (process.env.ANALYTICS_EXCLUDE_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return extra.includes(email);
}
