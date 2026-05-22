import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Root page just routes - middleware also handles unauthenticated case.
export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/home" : "/login");
}
