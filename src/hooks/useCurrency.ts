"use client";

import { useCallback, useMemo } from "react";
import { useCurrencyStore } from "@/stores/currencyStore";
import type { Country } from "@/lib/countries";

interface UseCurrencyReturn {
  /** The currently-selected country (from onboarding / Profile). */
  country: Country;
  /** Short symbol for quick display (e.g. "$", "₦", "£"). */
  symbol: string;
  /** ISO currency code (e.g. "USD", "NGN"). */
  code: string;
  /** Format a number with the user's currency symbol + locale-correct grouping. */
  format: (amount: number) => string;
}

/**
 * Reactive access to the user's chosen currency. Every UI surface that
 * displays an amount should use this hook so the symbol updates the instant
 * the user picks a different country in onboarding or Profile.
 *
 *   const { format, symbol } = useCurrency();
 *   <span>{format(client.outstanding_balance)}</span>
 */
export function useCurrency(): UseCurrencyReturn {
  const country = useCurrencyStore((s) => s.country);

  const format = useCallback(
    (amount: number) => {
      const num = new Intl.NumberFormat(country.locale, {
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(amount);
      // Always prefix with the country's preferred symbol (₦, $, £, ₹, etc.)
      // rather than relying on Intl currency display, which can output "NGN 1,234"
      // in some locales.
      return `${country.symbol}${num}`;
    },
    [country],
  );

  return useMemo(
    () => ({
      country,
      symbol: country.symbol,
      code: country.currency,
      format,
    }),
    [country, format],
  );
}
