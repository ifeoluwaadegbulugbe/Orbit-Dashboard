/**
 * Business branding (name, logo, accent colour, invoice footer). Edited on
 * the Branding page and stored in this browser; read wherever Orbit renders
 * something client-facing, like invoice PDFs.
 */

export const BRANDING_STORAGE_KEY = "orbit_branding_v1";

export interface Branding {
  business_name: string;
  tagline: string;
  logo_url: string;
  accent_color: string;
  invoice_footer: string;
}

export const DEFAULT_BRANDING: Branding = {
  business_name: "",
  tagline: "",
  logo_url: "",
  accent_color: "#E8557A",
  invoice_footer: "Thank you for your business!",
};

/** Saved branding merged over defaults. Safe to call when storage is unavailable. */
export function loadBranding(): Branding {
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (raw) return { ...DEFAULT_BRANDING, ...JSON.parse(raw) };
  } catch {
    // Private mode / blocked storage / bad JSON - fall back to defaults.
  }
  return DEFAULT_BRANDING;
}
