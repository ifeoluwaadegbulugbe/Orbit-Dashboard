/**
 * Server-side changes to a user's lifecycle email preferences. Used by the
 * unsubscribe link (no login, signed token) and the Settings toggles.
 * Never affects account, security or payment emails.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Preferences {
  tips: boolean;
  product_updates: boolean;
  promotions: boolean;
  weekly_summary: boolean;
}

/** Upsert that still works before migration 029 adds the weekly_summary column. */
async function upsertPrefs(supabase: SupabaseClient, row: Record<string, unknown>) {
  const { error } = await supabase.from("email_preferences").upsert(row);
  if (error && /weekly_summary/.test(error.message)) {
    const { weekly_summary: _, ...rest } = row;
    await supabase.from("email_preferences").upsert(rest);
  }
}

export async function unsubscribeAll(supabase: SupabaseClient, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await upsertPrefs(supabase, {
    user_id: userId, tips: false, product_updates: false, promotions: false, weekly_summary: false,
    unsubscribed_at: now, updated_at: now,
  });
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  const email = (profile?.email as string | undefined)?.trim().toLowerCase();
  if (email) {
    await supabase.from("email_suppressions").upsert({ email, reason: "unsubscribe", detail: "Unsubscribe link" });
  }
}

/** Saves category choices. Turning any category on undoes a full unsubscribe. */
export async function savePreferences(supabase: SupabaseClient, userId: string, prefs: Preferences): Promise<void> {
  const anyOn = prefs.tips || prefs.product_updates || prefs.promotions || prefs.weekly_summary;
  const now = new Date().toISOString();
  await upsertPrefs(supabase, {
    user_id: userId, ...prefs,
    unsubscribed_at: anyOn ? null : now,
    updated_at: now,
  });
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  const email = (profile?.email as string | undefined)?.trim().toLowerCase();
  if (!email) return;
  if (anyOn) {
    // Only lift a suppression the user created themselves - never a bounce or complaint.
    await supabase.from("email_suppressions").delete().eq("email", email).eq("reason", "unsubscribe");
  } else {
    await supabase.from("email_suppressions").upsert({ email, reason: "unsubscribe", detail: "Settings" });
  }
}

export async function getPreferences(supabase: SupabaseClient, userId: string): Promise<Preferences & { unsubscribed: boolean }> {
  const { data } = await supabase.from("email_preferences")
    .select("*").eq("user_id", userId).maybeSingle();
  return {
    tips: data?.tips ?? true,
    product_updates: data?.product_updates ?? true,
    promotions: data?.promotions ?? true,
    weekly_summary: data?.weekly_summary ?? true,
    unsubscribed: !!data?.unsubscribed_at,
  };
}
