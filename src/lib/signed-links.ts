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

type Purpose = "review" | "client" | "unsub";

function secret(): string {
  const s = process.env.LINK_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("LINK_SIGNING_SECRET is not set");
  return s;
}

export function signId(purpose: Purpose, id: string): string {
  return createHmac("sha256", secret()).update(`${purpose}:${id}`).digest("base64url").slice(0, 32);
}

export function verifyId(purpose: Purpose, id: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(signId(purpose, id));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
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
