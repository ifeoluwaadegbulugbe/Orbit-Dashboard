/**
 * Normalize a Supabase URL so common copy-paste mistakes don't break things.
 *
 * Handles:
 *   - Trailing slashes:  `https://abc.supabase.co/`    → `https://abc.supabase.co`
 *   - Extra paths:       `https://abc.supabase.co/auth/v1` → `https://abc.supabase.co`
 *   - Dashboard URLs:    `https://supabase.com/dashboard/project/abc` (caught - throws)
 *   - Whitespace:        `  https://abc.supabase.co  ` → `https://abc.supabase.co`
 *   - Missing protocol:  `abc.supabase.co`             → `https://abc.supabase.co`
 *   - Doubled protocol:  `https://https://abc.supabase.co` → `https://abc.supabase.co`
 */
export function sanitizeSupabaseUrl(raw: string | undefined): string {
  if (!raw) return "";
  let url = raw.trim();

  // Strip doubled protocol
  url = url.replace(/^https?:\/\/(https?:\/\/)/, "$1");

  // Add protocol if missing
  if (!/^https?:\/\//.test(url)) {
    url = `https://${url}`;
  }

  // The dashboard URL pattern is NOT a project URL - fail loudly
  if (url.includes("supabase.com/dashboard")) {
    throw new Error(
      "Looks like you copied the Supabase dashboard URL instead of your project's API URL. " +
        "Go to Settings → API and copy the 'Project URL' field.",
    );
  }

  // Parse and rebuild as origin-only (drops path, query, hash)
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    // If parsing fails, fall back to a manual strip
    return url.replace(/\/+$/, "").replace(/\/[^\/]*$/, "");
  }
}
