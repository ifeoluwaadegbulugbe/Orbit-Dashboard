"use client";

import { useEffect, useState } from "react";
import type { PaymentProvider } from "@/types";

const PAYMENT_CONNECTED_KEY = "orbit_payment_connected_v1";
const PAYMENT_KEYS_PREFIX = "orbit_payment_keys_";

interface ConnectedProvider {
  provider: PaymentProvider | null;
  /** True once we've checked localStorage - useful for skipping flicker. */
  hydrated: boolean;
}

/**
 * Read the user's saved per-provider credentials from localStorage. Shape
 * depends on the provider (see PROVIDER_INFO for the field names).
 */
export function getStoredProviderKeys(provider: PaymentProvider): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PAYMENT_KEYS_PREFIX + provider);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

/**
 * Reshape stored credentials into the keys object the /api/payments/[id]/link
 * route expects, per provider. Returns null if anything is missing.
 */
export function buildProviderKeysForRequest(
  provider: PaymentProvider,
): Record<string, string> | null {
  const stored = getStoredProviderKeys(provider);
  if (!stored) return null;

  if (provider === "stripe") {
    const apiKey = stored.stripe_secret_key;
    const storeId = stored.stripe_store_id;
    const variantId = stored.stripe_variant_id;
    if (!apiKey || !storeId || !variantId) return null;
    return { apiKey, storeId, variantId };
  }

  if (provider === "flutterwave") {
    const secretKey = stored.flutterwave_secret_key;
    if (!secretKey) return null;
    return { secretKey };
  }

  return null;
}

/**
 * Returns whichever payment provider the user connected on /payment-settings.
 * Hydrates from localStorage on mount; returns { provider: null } if nothing
 * is connected yet.
 */
export function useConnectedProvider(): ConnectedProvider {
  const [state, setState] = useState<ConnectedProvider>({ provider: null, hydrated: false });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PAYMENT_CONNECTED_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { provider?: string };
        // Only accept providers still recognized by the current build.
        // Older builds may have saved "paystack" or "stripe" - we treat those
        // as "no provider connected" and clean them up.
        const valid = saved.provider === "stripe" || saved.provider === "flutterwave";
        if (valid) {
          setState({ provider: saved.provider as PaymentProvider, hydrated: true });
          return;
        }
        if (saved.provider) {
          localStorage.removeItem(PAYMENT_CONNECTED_KEY);
        }
      }
    } catch {
      // ignore malformed entries
    }
    setState({ provider: null, hydrated: true });
  }, []);

  return state;
}
