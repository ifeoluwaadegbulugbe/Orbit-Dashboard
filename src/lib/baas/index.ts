import "server-only";
import { NotConfiguredBaasProvider } from "./not-configured";
import { PaystackBaasProvider } from "./paystack";
import type { BaasProvider } from "./types";

export type { BaasProvider, ResolvedBankAccount, PayoutResult, VirtualAccount, AccountBalance } from "./types";
export { BaasNotConfiguredError } from "./types";

/**
 * Returns the active BaaS provider. Uses Orbit's own Paystack account
 * (pooled custody - see the "Custody path" decision) when PAYSTACK_SECRET_KEY
 * is set, otherwise falls back to the not-configured stub. A real Anchor/Mono
 * integration, if pursued later, is a new file implementing BaasProvider,
 * swapped in here - not a rewrite of anything that calls getBaasProvider().
 */
export function getBaasProvider(): BaasProvider {
  if (process.env.PAYSTACK_SECRET_KEY) {
    return new PaystackBaasProvider();
  }
  return new NotConfiguredBaasProvider();
}
