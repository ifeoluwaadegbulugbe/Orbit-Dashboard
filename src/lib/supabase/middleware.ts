import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeSupabaseUrl } from "./sanitize";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/verify-email",               // post-signup "check your inbox" screen
  "/forgot-password",            // step 1: enter email
  "/reset-password",             // step 2: set new password (auth via recovery session)
  "/auth/callback",              // Supabase email-link target
  "/terms",
  "/privacy",
  "/book",                       // public Calendly-style booking pages
  "/api/public/bookings",        // unauthed booking submission endpoint
  "/api/paystack/webhook",
  "/api/lemonsqueezy/webhook",
  "/api/flutterwave/webhook",
];

// Track whether we've already warned about a misconfigured Supabase URL in this
// process. Without this, every single request would log the same scary stack trace.
let warnedAboutMissingConfig = false;
let warnedAboutUnreachableSupabase = false;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  let url: string;
  try {
    url = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  } catch (err) {
    if (!warnedAboutMissingConfig) {
      console.warn(`\n⚠️  ${err instanceof Error ? err.message : String(err)}\n`);
      warnedAboutMissingConfig = true;
    }
    return response;
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // ── 1. Missing env vars ─────────────────────────────────────────────────
  // If Supabase isn't configured at all, let everything through but warn once.
  if (!url || !anonKey || url.includes("YOUR_PROJECT")) {
    if (!warnedAboutMissingConfig) {
      console.warn(
        "\n⚠️  Supabase is not configured.\n" +
          "   Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.\n" +
          "   See README.md → 'Setup' for details.\n",
      );
      warnedAboutMissingConfig = true;
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // ── 2. Try to read the session ──────────────────────────────────────────
  // Wrap in try/catch so DNS / network failures don't crash the request.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isDnsError =
      msg.includes("ENOTFOUND") ||
      msg.includes("getaddrinfo") ||
      msg.includes("fetch failed");

    if (!warnedAboutUnreachableSupabase) {
      console.warn(
        `\n⚠️  Could not reach Supabase at ${url}\n` +
          (isDnsError
            ? "   DNS resolution failed - your Supabase URL is probably wrong.\n" +
              "   Double-check NEXT_PUBLIC_SUPABASE_URL in .env.local against:\n" +
              "   Supabase Dashboard → Settings → API → Project URL\n"
            : `   ${msg}\n`) +
          "   The app will run in 'logged-out' mode until this is fixed.\n",
      );
      warnedAboutUnreachableSupabase = true;
    }
    // Treat as unauthenticated and continue
    user = null;
  }

  // ── 3. Routing ──────────────────────────────────────────────────────────
  // Unauthenticated users hitting a private route → bounce to /login
  if (!user && !isPublic && pathname !== "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated users hitting /login or /signup → bounce to /home.
  // /verify-email and /reset-password are deliberately reachable while
  // authed (they're part of the post-verification + recovery flows).
  if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/home";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
