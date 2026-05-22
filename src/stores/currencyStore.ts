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
    { name: "orbit_currency_v1" },
  ),
);

export { COUNTRIES };
