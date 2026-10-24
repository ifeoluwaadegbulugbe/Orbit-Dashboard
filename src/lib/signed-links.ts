/**
 * Private, unguessable links for people who don't have an Orbit login:
 *   /review/<bookingId>?t=<sig>  - a client leaves a review for one booking
 *   /c/<clientId>?t=<sig>        - a client's "my appointments" page
 *
 * The signature is an HMAC of the id, so a link can't be forged or pointed
 * at another booking/client. Set LINK_SIGNING_SECRET (any long random
 * string); changing it invalidates every link already sent.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "@/lib/app-url";

type Purpose = "review" | "client" | "unsub" | "pay";

function secret(): string {
  const s = process.env.LINK_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("LINK_SIGNING_SECRET is not set");
  return s;
}

export function signId(purpose: Purpose, id: string): string {
  return createHmac("sha256", secret()).update(`${purpose}:${id}`).digest("base64url").slice(0, 32);
}

/**
 * Accepts links signed with LINK_SIGNING_SECRET and, so links already sent
 * keep working after it's set, links signed with the old fallback key.
 */
export function verifyId(purpose: Purpose, id: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const given = Buffer.from(token);
  const keys = [process.env.LINK_SIGNING_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY].filter((k): k is string => !!k);
  return keys.some((k) => {
    const expected = Buffer.from(createHmac("sha256", k).update(`${purpose}:${id}`).digest("base64url").slice(0, 32));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

export function appOrigin(request?: Request): string {
  return appUrl((request ? new URL(request.url).origin : "") || "http://localhost:3000");
}

export function reviewUrl(bookingId: string, request?: Request): string {
  return `${appOrigin(request)}/review/${bookingId}?t=${signId("review", bookingId)}`;
}

export function clientPortalUrl(clientId: string, request?: Request): string {
  return `${appOrigin(request)}/c/${clientId}?t=${signId("client", clientId)}`;
}

/** The client's Orbit Pay page for one charge: shows the fee breakdown, then hands over to Paystack. */
export function payUrl(chargeId: string, request?: Request): string {
  return `${appOrigin(request)}/pay/${chargeId}?t=${signId("pay", chargeId)}`;
}
