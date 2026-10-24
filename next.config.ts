import type { NextConfig } from "next";
import path from "node:path";

const supabaseOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin; } catch { return "https://*.supabase.co"; }
})();

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",          // Next.js inline bootstrap scripts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",          // business photos, avatars, QR codes
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.paystack.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so Next.js doesn't get confused by the stray
    // package-lock.json sitting at C:\Users\USER\New\.
    root: path.resolve(__dirname),
  },

  // Hide the bottom-corner dev mode "Compiling..." / "Building..." indicator.
  // Setting `devIndicators: false` disables the overlay entirely.
  devIndicators: false,

  // PostHog through our own domain (/ingest), as PostHog recommends, so
  // privacy/ad blockers don't silently drop product analytics.
  // Basic browser protections on every page.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },          // no clickjacking in someone else's frame
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // signed links don't leak in full
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        // Where pages may load code from and send data to. If anything ever
        // got injected into a page, it couldn't phone home elsewhere.
        ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
      ],
    }];
  },

  // The old Wallet page is now Money -> Orbit Pay.
  async redirects() {
    return [{ source: "/wallet", destination: "/payments?tab=pay", permanent: false }];
  },

  async rewrites() {
    const ingest = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");
    const assets = ingest.replace("://us.i.", "://us-assets.i.").replace("://eu.i.", "://eu-assets.i.");
    return [
      { source: "/ingest/static/:path*", destination: `${assets}/static/:path*` },
      { source: "/ingest/:path*", destination: `${ingest}/:path*` },
    ];
  },
  // PostHog's API paths end in "/" - don't redirect them.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
