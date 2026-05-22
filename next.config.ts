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
};

export default nextConfig;
