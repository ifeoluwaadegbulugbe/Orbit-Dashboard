"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { COUNTRIES, DEFAULT_COUNTRY, findCountryByCode, type Country } from "@/lib/countries";

interface CurrencyState {
  country: Country;
  setCountry: (country: Country) => void;
  hydrateFromCode: (code: string | null | undefined) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      country: DEFAULT_COUNTRY,
      setCountry: (country) => set({ country }),
      hydrateFromCode: (code) => {
        const c = findCountryByCode(code);
        if (c) set({ country: c });
      },
    }),
    {
      name: "orbit_currency_v1",
      // Only the code is trusted from storage; the rest comes from the
      // current list, so devices saved before a field was added stay correct.
      merge: (persisted, current) => {
        const code = (persisted as { country?: { code?: string } } | undefined)?.country?.code;
        return { ...current, country: findCountryByCode(code) ?? current.country };
      },
    },
  ),
);

export { COUNTRIES };
