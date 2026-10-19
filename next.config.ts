import type { NextConfig } from "next";
import path from "node:path";

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
