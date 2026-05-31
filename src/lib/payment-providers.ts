// lib/payment-providers.ts
//
// This file is the SINGLE place where payment providers are defined.
// Every UI card, wizard, and detection function reads from here.
// To add a provider: add it to PaymentProvider and PROVIDER_INFO — nothing else.
// To remove one: delete its entry — it disappears everywhere automatically.

// ─── Types ──────────────────────────────────────────────────────────────────

export type PaymentProvider = "stripe" | "flutterwave";

export interface ProviderInfo {
  name: string;
  /** One-line pitch shown under the provider name on the settings card. */
  tagline: string;
  /** Two-sentence description shown in the expanded card body. */
  description: string;
  /** Brand hex color — used for the card accent, button, and method pills. */
  color: string;
  /** Payment methods this provider supports — shown as pills. */
  supportedMethods: string[];
  /** Link to the provider's own dashboard — shown in the help guide CTA. */
  docsUrl: string;
  /**
   * Fields the setup wizard will ask for.
   * Each entry becomes one labeled input in the wizard form.
   * - key:         the localStorage key suffix and the form field name
   * - label:       the visible input label
   * - placeholder: hint text inside the input
   * - hint:        small grey text shown below the input
   */
  wizardFields: {
    key: string;
    label: string;
    placeholder: string;
    hint: string;
  }[];
}

// ─── Provider registry ───────────────────────────────────────────────────────

export const PROVIDER_INFO: Record<PaymentProvider, ProviderInfo> = {

  // ── Stripe ──────────────────────────────────────────────────────────────
  stripe: {
    name: "Stripe",
    tagline: "Best for global businesses",
    description:
      "Accept cards, Apple Pay, and Google Pay anywhere in the world. " +
      "Payouts land in your own bank account — usually within 2 business days.",
    color: "#635BFF",
    supportedMethods: ["Cards", "Apple Pay", "Google Pay", "Bank transfer"],
    docsUrl: "https://dashboard.stripe.com",
    wizardFields: [
      {
        key: "secretKey",
        label: "Secret key",
        placeholder: "sk_live_…  or  sk_test_…",
        hint:
          "Find this in your Stripe dashboard under Developers → API keys. " +
          "Use sk_test_ to try things out before going live.",
      },
    ],
  },

  // ── Flutterwave ─────────────────────────────────────────────────────────
  // DO NOT MODIFY — Flutterwave logic is unchanged from the original codebase.
  flutterwave: {
    name: "Flutterwave",
    tagline: "Best for African markets",
    description:
      "Covers Nigeria, Ghana, Kenya, and 30+ African countries. " +
      "Accepts cards, mobile money, bank transfers, and USSD — payouts go to your local bank.",
    color: "#F5A623",
    supportedMethods: ["Cards", "Mobile money", "Bank transfer", "USSD"],
    docsUrl: "https://dashboard.flutterwave.com",
    wizardFields: [
      {
        key: "publicKey",
        label: "Public key",
        placeholder: "FLWPUBK_TEST-…",
        hint: "Found in your Flutterwave dashboard under Settings → API.",
      },
      {
        key: "secretKey",
        label: "Secret key",
        placeholder: "FLWSECK_TEST-…",
        hint: "Same page — click the eye icon to reveal it. Never share this.",
      },
    ],
  },
};

// ─── Geo-detection ──────────────────────────────────────────────────────────
//
// Returns the recommended provider for a given ISO-3166 country code.
// Called once on the settings page to pre-badge the right card.

const FLUTTERWAVE_COUNTRIES = new Set([
  "NG", "GH", "KE", "TZ", "UG", "ZA", "CI", "SN", "CM", "RW",
  "ZM", "MW", "MZ", "ET", "EG", "MA", "TN", "DZ", "ZW", "BJ",
  "BF", "ML", "NE", "TD", "GN", "MR", "SL", "LR", "GM", "GW",
  "CV", "ST", "CF", "CG", "CD", "GA", "GQ", "AO", "NA", "BW",
  "LS", "SZ", "SO", "DJ", "ER", "SS", "SD", "LY", "MG", "KM",
  "SC", "MU", "RE", "YT",
]);

export function detectProvider(countryCode: string): PaymentProvider {
  return FLUTTERWAVE_COUNTRIES.has(countryCode.toUpperCase())
    ? "flutterwave"
    : "stripe";
}

// ─── localStorage helpers ────────────────────────────────────────────────────
//
// Centralised key names so every file reads/writes the same localStorage slots.
// Keys stay on the user's device — never sent to Orbit's database.

export const STORAGE_CONNECTED_KEY = "orbit_payment_connected_v1";
export const STORAGE_KEYS_PREFIX   = "orbit_payment_keys_";

/** Returns the saved keys for a given provider, or null if not connected. */
export function getStoredKeys(
  provider: PaymentProvider
): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS_PREFIX + provider);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

/** Saves keys and marks the provider as connected. */
export function saveProviderKeys(
  provider: PaymentProvider,
  keys: Record<string, string>
): void {
  localStorage.setItem(STORAGE_KEYS_PREFIX + provider, JSON.stringify(keys));
  localStorage.setItem(STORAGE_CONNECTED_KEY, JSON.stringify({ provider }));
}

/** Removes all stored data for a provider and clears the connected state. */
export function disconnectProvider(provider: PaymentProvider): void {
  localStorage.removeItem(STORAGE_KEYS_PREFIX + provider);
  localStorage.removeItem(STORAGE_CONNECTED_KEY);
}

/** Reads the currently-connected provider from localStorage, or null. */
export function getConnectedProvider(): PaymentProvider | null {
  try {
    const raw = localStorage.getItem(STORAGE_CONNECTED_KEY);
    if (!raw) return null;
    const { provider } = JSON.parse(raw) as { provider?: string };
    return provider && provider in PROVIDER_INFO
      ? (provider as PaymentProvider)
      : null;
  } catch {
    return null;
  }
}