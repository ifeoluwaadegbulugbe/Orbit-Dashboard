import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";

/**
 * GET /e/<lifecycleEmailId>?to=/some/path - click tracking for lifecycle
 * emails. Records the first click, then redirects inside Orbit.
 *
 * Only same-site paths are accepted ("/services", never "https://evil" or
 * "//evil"), so this can't be used as an open redirect.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const to = new URL(request.url).searchParams.get("to") ?? "/home";
  const safePath = to.startsWith("/") && !to.startsWith("//") && !to.includes("\\") ? to : "/home";
  const base = appUrl(new URL(request.url).origin);

  if (/^[0-9a-f-]{36}$/i.test(id)) {
    try {
      await createServiceClient()
        .from("lifecycle_emails")
        .update({ clicked_at: new Date().toISOString() })
        .eq("id", id)
        .is("clicked_at", null);
    } catch {
      // Tracking must never block the redirect.
    }
  }
  return NextResponse.redirect(`${base}${safePath}`, 302);
}
