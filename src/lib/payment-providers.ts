import type { PaymentProvider } from "@/types";

export interface ProviderInfo {
  name: string;
  tagline: string;
  description: string;
  color: string;
  supportedMethods: string[];
  /** Where the merchant can sign up + grab their keys. */
  dashboardUrl: string;
  /** Specific fields the user needs to fill in for this provider. */
  keyFields: {
    name: string;
    label: string;
    placeholder: string;
    hint: string;
    /** True if this value is sensitive and shouldn't be echoed back to the UI. */
    secret: boolean;
  }[];
}

export const PROVIDER_INFO: Record<PaymentProvider, ProviderInfo> = {
  lemonsqueezy: {
    name: "Lemon Squeezy",
    tagline: "Best for global businesses",
    description: "Card payments worldwide, automatic VAT handling, instant payouts.",
    color: "#FFC233",
    supportedMethods: ["Cards", "Apple Pay", "Google Pay", "PayPal"],
    dashboardUrl: "https://app.lemonsqueezy.com",
    keyFields: [
      {
        name: "lemonsqueezy_api_key",
        label: "API key",
        placeholder: "eyJ0eXAiOiJKV1Qi...",
        hint: "Settings -> API. Create a key with at least 'checkouts:write' scope.",
        secret: true,
      },
      {
        name: "lemonsqueezy_store_id",
        label: "Store ID",
        placeholder: "12345",
        hint: "The numeric ID of the store you'll accept payments for.",
        secret: false,
      },
      {
        name: "lemonsqueezy_variant_id",
        label: "Pay-what-you-want variant ID",
        placeholder: "67890",
        hint: "Create a product with a Pay-what-you-want variant in LS. Paste its ID here.",
        secret: false,
      },
    ],
  },
  flutterwave: {
    name: "Flutterwave",
    tagline: "Best for African markets",
    description: "Pan-African payments. Cards, mobile money, bank transfers, USSD.",
    color: "#F5A623",
    supportedMethods: ["Cards", "Mobile money", "Bank transfer", "USSD"],
    dashboardUrl: "https://dashboard.flutterwave.com",
    keyFields: [
      {
        name: "flutterwave_secret_key",
        label: "Secret key",
        placeholder: "FLWSECK_TEST-xxxxxxxxxxxxxxxx-X",
        hint: "Settings -> API. Use test keys (FLWSECK_TEST-...) while developing.",
        secret: true,
      },
      {
        name: "flutterwave_public_key",
        label: "Public key",
        placeholder: "FLWPUBK_TEST-xxxxxxxxxxxxxxxx-X",
        hint: "Settings -> API. Safe to share with the browser.",
        secret: false,
      },
    ],
  },
};

/** Best provider for a given country. */
export function detectProvider(countryCode: string): PaymentProvider {
  const code = countryCode.toUpperCase();
  // Pan-African and adjacent markets get Flutterwave by default
  if (["NG", "GH", "ZA", "KE", "EG", "UG", "RW", "TZ", "CI", "SN"].includes(code)) {
    return "flutterwave";
  }
  // Everyone else: Lemon Squeezy (global card support + tax handling)
  return "lemonsqueezy";
}
