import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyId } from "@/lib/signed-links";
import { unsubscribeAll } from "@/lib/lifecycle/preferences";

/**
 * POST /api/email/unsubscribe?u=<userId>&t=<signature>
 *
 * Handles both the button on /email/unsubscribe and RFC 8058 one-click
 * unsubscribe (mail apps POST "List-Unsubscribe=One-Click" to the URL in
 * the List-Unsubscribe header). Unsubscribes from all lifecycle/marketing
 * email; account, security and payment emails keep working.
 *
 * Deliberately POST-only: link scanners that pre-open GET URLs in emails
 * can't unsubscribe people by accident.
 */
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const userId = params.get("u") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !verifyId("unsub", userId, params.get("t"))) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }
  await unsubscribeAll(createServiceClient(), userId);

  // Form submissions from our own page go back to it; mail-app one-click gets a plain 200.
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("form") ? await request.text() : "";
  if (body.includes("List-Unsubscribe=One-Click")) return NextResponse.json({ ok: true });
  if (contentType.includes("form")) {
    const back = new URL(request.url);
    back.pathname = "/email/unsubscribe";
    back.searchParams.set("done", "1");
    return NextResponse.redirect(back, 303);
  }
  return NextResponse.json({ ok: true });
}
