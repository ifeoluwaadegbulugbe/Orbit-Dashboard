export interface Country {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  flag: string;
  locale: string;
}

/**
 * Curated list of countries Orbit serves. Tuned for service businesses in
 * Nigeria, the rest of Africa, US/UK/EU. Mirrors the mobile app's COUNTRIES.
 */
export const COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria",       currency: "NGN", symbol: "₦", flag: "🇳🇬", locale: "en-NG" },
  { code: "US", name: "United States", currency: "USD", symbol: "$", flag: "🇺🇸", locale: "en-US" },
  { code: "GB", name: "United Kingdom",currency: "GBP", symbol: "£", flag: "🇬🇧", locale: "en-GB" },
  { code: "EU", name: "European Union",currency: "EUR", symbol: "€", flag: "🇪🇺", locale: "en-IE" },
  { code: "CA", name: "Canada",        currency: "CAD", symbol: "$", flag: "🇨🇦", locale: "en-CA" },
  { code: "AU", name: "Australia",     currency: "AUD", symbol: "$", flag: "🇦🇺", locale: "en-AU" },
  { code: "ZA", name: "South Africa",  currency: "ZAR", symbol: "R", flag: "🇿🇦", locale: "en-ZA" },
  { code: "KE", name: "Kenya",         currency: "KES", symbol: "KSh", flag: "🇰🇪", locale: "en-KE" },
  { code: "GH", name: "Ghana",         currency: "GHS", symbol: "₵", flag: "🇬🇭", locale: "en-GH" },
  { code: "EG", name: "Egypt",         currency: "EGP", symbol: "E£", flag: "🇪🇬", locale: "en-EG" },
  { code: "IN", name: "India",         currency: "INR", symbol: "₹", flag: "🇮🇳", locale: "en-IN" },
  { code: "AE", name: "UAE",           currency: "AED", symbol: "د.إ", flag: "🇦🇪", locale: "en-AE" },
  { code: "BR", name: "Brazil",        currency: "BRL", symbol: "R$", flag: "🇧🇷", locale: "pt-BR" },
  { code: "MX", name: "Mexico",        currency: "MXN", symbol: "$", flag: "🇲🇽", locale: "es-MX" },
  { code: "PH", name: "Philippines",   currency: "PHP", symbol: "₱", flag: "🇵🇭", locale: "en-PH" },
];

export const DEFAULT_COUNTRY = COUNTRIES[1]; // US

export function findCountryByCode(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code);
}
