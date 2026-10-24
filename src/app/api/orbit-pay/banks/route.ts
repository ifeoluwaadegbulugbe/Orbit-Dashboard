import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listNigerianBanks } from "@/lib/orbit-pay/paystack";

/** GET /api/orbit-pay/banks - Nigerian banks Paystack can settle to. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ banks: await listNigerianBanks() }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    console.error("[orbit-pay/banks]", err);
    return NextResponse.json({ error: "Couldn't load banks. Try again." }, { status: 502 });
  }
}
