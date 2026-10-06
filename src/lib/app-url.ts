/**
 * The app's public base URL from NEXT_PUBLIC_APP_URL, cleaned up: stray
 * spaces and trailing slashes in the env value are easy to paste in and
 * silently break every link built from it ("https://x.com//payments",
 * " https://x.com"). Safe to use on the server and in the browser.
 */
export function appUrl(fallback = "http://localhost:3000"): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim() || fallback;
  return raw.replace(/\/+$/, "");
}
