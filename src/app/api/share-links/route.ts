import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientPortalUrl, reviewUrl } from "@/lib/signed-links";

/**
 * GET /api/share-links?clientId=...   -> { url }  the client's "my appointments" link
 * GET /api/share-links?bookingId=...  -> { url }  the review link for one booking
 *
 * Signing happens server-side (the secret never reaches the browser). The
 * lookup runs as the signed-in owner, so RLS guarantees they can only get
 * links for their own clients and bookings.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const clientId = params.get("clientId");
  const bookingId = params.get("bookingId");

  if (clientId) {
    const { data } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    return NextResponse.json({ url: clientPortalUrl(clientId, request) });
  }
  if (bookingId) {
    const { data } = await supabase.from("bookings").select("id").eq("id", bookingId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    return NextResponse.json({ url: reviewUrl(bookingId, request) });
  }
  return NextResponse.json({ error: "Pass clientId or bookingId" }, { status: 400 });
}
