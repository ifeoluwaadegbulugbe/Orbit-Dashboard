/**
 * The public booking profile stored in profiles.booking_link (jsonb).
 * Edited on /booking-link, rendered on /book/<slug>.
 */

export interface BookingService {
  name: string;
  duration_minutes: number;
  price: string;
}

export interface BookingConfig {
  slug: string;
  intro: string;
  services: BookingService[];
  /** Free-text opening hours, e.g. "Mon–Sat · 9am–7pm". */
  availability: string;
  /** Area / address shown on the page and used for the Directions button. */
  location?: string;
  /** Instagram handle without @. */
  instagram?: string;
  /** WhatsApp number clients can message, any format. */
  whatsapp?: string;
  /** Public URLs of work photos (max MAX_PHOTOS). */
  photos?: string[];
}

export const MAX_PHOTOS = 8;
export const PHOTO_BUCKET = "business-photos";

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  slug: "",
  intro: "Choose a service and a time that works for you. I'll confirm by message within an hour.",
  services: [{ name: "Initial consultation", duration_minutes: 30, price: "Free" }],
  availability: "Mon–Fri · 9am–6pm",
  location: "",
  instagram: "",
  whatsapp: "",
  photos: [],
};

export function instagramUrl(handle?: string): string | null {
  const h = (handle ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
  return h ? `https://instagram.com/${h}` : null;
}

export function whatsappUrl(number?: string, text?: string): string | null {
  let digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.startsWith("0") && digits.length === 11) digits = `234${digits.slice(1)}`; // Nigerian local format
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function directionsUrl(location?: string): string | null {
  const l = (location ?? "").trim();
  return l ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l)}` : null;
}
