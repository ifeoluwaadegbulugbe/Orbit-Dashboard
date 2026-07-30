import "server-only";
import { NotConfiguredBaasProvider } from "./not-configured";
import type { BaasProvider } from "./types";

export type { BaasProvider, ResolvedBankAccount, PayoutResult, VirtualAccount, AccountBalance } from "./types";
export { BaasNotConfiguredError } from "./types";

/**
 * Returns the active BaaS provider. Today this is always the
 * not-configured stub - real money can't move through the wallet until
 * an Anchor or Mono integration is added here (a new file implementing
 * BaasProvider, selected below once ANCHOR_API_KEY / MONO_SECRET_KEY
 * exist), following the interface in ./types.ts.
 */
export function getBaasProvider(): BaasProvider {
  return new NotConfiguredBaasProvider();
}
