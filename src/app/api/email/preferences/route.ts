import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences, savePreferences } from "@/lib/lifecycle/preferences";

/** GET/PUT /api/email/preferences - the signed-in owner's lifecycle email choices. */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getPreferences(createServiceClient(), userId));
  } catch {
    return NextResponse.json({ error: "Email preferences aren't set up yet" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const prefs = {
    tips: body.tips !== false,
    product_updates: body.product_updates !== false,
    promotions: body.promotions !== false,
  };
  await savePreferences(createServiceClient(), userId, prefs);
  return NextResponse.json({ ok: true, ...prefs, unsubscribed: !(prefs.tips || prefs.product_updates || prefs.promotions) });
}
