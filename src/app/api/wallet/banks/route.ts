import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listBanks } from "@/lib/baas/paystack";

/** Bank list for the Add Bank Account dropdown. Requires auth, nothing user-specific. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const banks = await listBanks();
    return NextResponse.json({ banks });
  } catch (err) {
    console.error("[wallet/banks] listBanks failed:", err);
    return NextResponse.json({ error: "Could not load bank list." }, { status: 502 });
  }
}
