import "server-only";
import { BaasNotConfiguredError } from "./types";
import type { BaasProvider, ResolvedBankAccount, PayoutResult, VirtualAccount, AccountBalance } from "./types";

/**
 * The default provider until a real Anchor/Mono integration is wired in.
 * Every method throws BaasNotConfiguredError rather than faking success -
 * callers must handle that and show an honest "not live yet" state, never
 * a fabricated result.
 */
export class NotConfiguredBaasProvider implements BaasProvider {
  readonly name = "not_configured";
  readonly isConfigured = false;

  async resolveBankAccount(): Promise<ResolvedBankAccount> {
    throw new BaasNotConfiguredError(this.name, "resolveBankAccount");
  }

  async initiatePayout(): Promise<PayoutResult> {
    throw new BaasNotConfiguredError(this.name, "initiatePayout");
  }

  async createVirtualAccount(): Promise<VirtualAccount> {
    throw new BaasNotConfiguredError(this.name, "createVirtualAccount");
  }

  async getAccountBalance(): Promise<AccountBalance> {
    throw new BaasNotConfiguredError(this.name, "getAccountBalance");
  }
}
