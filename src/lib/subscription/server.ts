/**
 * Server-side Pro checks for API routes. The app's screens hide Pro
 * features from Free users, but that's only the front door - these make
 * the API itself refuse, so nobody can reach a Pro feature by calling it
 * directly.
 */

import "server-only";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isProServer } from "./isPro";

export async function userIsPro(userId: string, email?: string | null): Promise<boolean> {
  const { data } = await createServiceClient()
    .from("profiles").select("email, subscription_status, trial_ends_at").eq("id", userId).maybeSingle();
  return isProServer({ ...data, email: data?.email ?? email ?? null });
}

/** null if the user is Pro; otherwise a 402 response to return as-is. */
export async function requirePro(userId: string, email: string | null | undefined, feature: string): Promise<NextResponse | null> {
  if (await userIsPro(userId, email)) return null;
  return NextResponse.json(
    { error: `${feature} is part of Orbit Pro. Upgrade to use it.`, code: "PRO_REQUIRED" },
    { status: 402 },
  );
}
