export interface Country {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  flag: string;
  locale: string;
  /** International dialling code without "+", e.g. "234". */
  dialCode: string;
  region: "Africa" | "Rest of the world";
}

type Row = [code: string, name: string, currency: string, symbol: string, dialCode: string, locale?: string];

/** ISO country code -> emoji flag ("NG" -> 🇳🇬). */
function flagOf(code: string): string {
  return code === "EU" ? "🇪🇺" : String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function build(rows: Row[], region: Country["region"]): Country[] {
  return rows.map(([code, name, currency, symbol, dialCode, locale]) => ({
    code, name, currency, symbol, dialCode, region, flag: flagOf(code), locale: locale ?? `en-${code}`,
  }));
}

// Every African country (Nigeria first, then A-Z). CFA franc zones share
// XOF (West) / XAF (Central). Zimbabwe trades mostly in US dollars.
const AFRICA: Row[] = [
  ["NG", "Nigeria", "NGN", "₦", "234"],
  ["DZ", "Algeria", "DZD", "DA", "213"],
  ["AO", "Angola", "AOA", "Kz", "244"],
  ["BJ", "Benin", "XOF", "CFA", "229"],
  ["BW", "Botswana", "BWP", "P", "267"],
  ["BF", "Burkina Faso", "XOF", "CFA", "226"],
  ["BI", "Burundi", "BIF", "FBu", "257"],
  ["CV", "Cabo Verde", "CVE", "Esc", "238"],
  ["CM", "Cameroon", "XAF", "FCFA", "237"],
  ["CF", "Central African Republic", "XAF", "FCFA", "236"],
  ["TD", "Chad", "XAF", "FCFA", "235"],
  ["KM", "Comoros", "KMF", "CF", "269"],
  ["CG", "Congo", "XAF", "FCFA", "242"],
  ["CD", "Congo (DRC)", "CDF", "FC", "243"],
  ["CI", "Côte d'Ivoire", "XOF", "CFA", "225"],
  ["DJ", "Djibouti", "DJF", "Fdj", "253"],
  ["EG", "Egypt", "EGP", "E£", "20"],
  ["GQ", "Equatorial Guinea", "XAF", "FCFA", "240"],
  ["ER", "Eritrea", "ERN", "Nfk", "291"],
  ["SZ", "Eswatini", "SZL", "E", "268"],
  ["ET", "Ethiopia", "ETB", "Br", "251"],
  ["GA", "Gabon", "XAF", "FCFA", "241"],
  ["GM", "Gambia", "GMD", "D", "220"],
  ["GH", "Ghana", "GHS", "GH₵", "233"],
  ["GN", "Guinea", "GNF", "FG", "224"],
  ["GW", "Guinea-Bissau", "XOF", "CFA", "245"],
  ["KE", "Kenya", "KES", "KSh", "254"],
  ["LS", "Lesotho", "LSL", "M", "266"],
  ["LR", "Liberia", "LRD", "L$", "231"],
  ["LY", "Libya", "LYD", "LD", "218"],
  ["MG", "Madagascar", "MGA", "Ar", "261"],
  ["MW", "Malawi", "MWK", "MK", "265"],
  ["ML", "Mali", "XOF", "CFA", "223"],
  ["MR", "Mauritania", "MRU", "UM", "222"],
  ["MU", "Mauritius", "MUR", "Rs", "230"],
  ["MA", "Morocco", "MAD", "MAD", "212"],
  ["MZ", "Mozambique", "MZN", "MT", "258"],
  ["NA", "Namibia", "NAD", "N$", "264"],
  ["NE", "Niger", "XOF", "CFA", "227"],
  ["RW", "Rwanda", "RWF", "RF", "250"],
  ["ST", "São Tomé and Príncipe", "STN", "Db", "239"],
  ["SN", "Senegal", "XOF", "CFA", "221"],
  ["SC", "Seychelles", "SCR", "SR", "248"],
  ["SL", "Sierra Leone", "SLE", "Le", "232"],
  ["SO", "Somalia", "SOS", "Sh", "252"],
  ["ZA", "South Africa", "ZAR", "R", "27"],
  ["SS", "South Sudan", "SSP", "SSP", "211"],
  ["SD", "Sudan", "SDG", "SDG", "249"],
  ["TZ", "Tanzania", "TZS", "TSh", "255"],
  ["TG", "Togo", "XOF", "CFA", "228"],
  ["TN", "Tunisia", "TND", "DT", "216"],
  ["UG", "Uganda", "UGX", "USh", "256"],
  ["ZM", "Zambia", "ZMW", "K", "260"],
  ["ZW", "Zimbabwe", "USD", "$", "263"],
];

const REST: Row[] = [
  ["US", "United States", "USD", "$", "1"],
  ["GB", "United Kingdom", "GBP", "£", "44"],
  ["EU", "European Union", "EUR", "€", "", "en-IE"],
  ["CA", "Canada", "CAD", "C$", "1"],
  ["AU", "Australia", "AUD", "A$", "61"],
  ["NZ", "New Zealand", "NZD", "NZ$", "64"],
  ["AE", "UAE", "AED", "AED", "971"],
  ["SA", "Saudi Arabia", "SAR", "SAR", "966"],
  ["IN", "India", "INR", "₹", "91"],
  ["PH", "Philippines", "PHP", "₱", "63"],
  ["JM", "Jamaica", "JMD", "J$", "1"],
  ["BR", "Brazil", "BRL", "R$", "55", "pt-BR"],
  ["MX", "Mexico", "MXN", "MX$", "52", "es-MX"],
];

/**
 * Countries Orbit serves: all of Africa, then the main diaspora markets.
 * Mirrors the mobile app's COUNTRIES.
 */
export const COUNTRIES: Country[] = [...build(AFRICA, "Africa"), ...build(REST, "Rest of the world")];

/** Orbit is Nigeria-first (matches the mobile app and DEFAULT_TIMEZONE). */
export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountryByCode(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code);
}

/** "₦5,000", but "KSh 5,000" / "CFA 5,000" when the symbol is letters. */
export function formatWithSymbol(symbol: string, formattedNumber: string): string {
  return /\p{L}$/u.test(symbol) ? `${symbol} ${formattedNumber}` : `${symbol}${formattedNumber}`;
}

/** Amount in a business's own currency, for server-rendered pages and emails. */
export function formatMoney(amount: number, countryCode: string | null | undefined): string {
  const c = findCountryByCode(countryCode) ?? DEFAULT_COUNTRY;
  const n = new Intl.NumberFormat(c.locale, { maximumFractionDigits: 2 }).format(Number(amount) || 0);
  return formatWithSymbol(c.symbol, n);
}

/** Dialling code for a business's country ("234" when unknown - Orbit is Nigeria-first). */
export function dialCodeFor(countryCode: string | null | undefined): string {
  return findCountryByCode(countryCode)?.dialCode || DEFAULT_COUNTRY.dialCode;
}
