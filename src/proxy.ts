import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: `middleware` was renamed to `proxy`. Same behaviour, new file name.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except static assets and image optimization paths
    // (also the PWA files - the service worker and manifest must load signed out)
    "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
