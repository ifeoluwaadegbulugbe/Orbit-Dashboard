/**
 * The contract every Banking-as-a-Service partner (Anchor, Mono, ...)
 * implements. The rest of the app codes against this interface, never
 * against a specific provider's SDK/API shape directly - swapping or
 * adding a partner later is a new adapter, not a rewrite (blueprint
 * Section 27).
 */

export interface ResolvedBankAccount {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  /** The name the BANK has on file - never trust a user-typed name. */
  accountName: string;
}

export interface PayoutResult {
  providerReference: string;
  status: "processing" | "completed" | "failed";
  failureReason?: string;
}

export interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  /** The partner's own id for this account - store this, not raw credentials. */
  externalRef: string;
}

export interface AccountBalance {
  balanceMinor: number;
  currency: string;
}

export interface BaasProvider {
  readonly name: string;
  readonly isConfigured: boolean;

  /** Name-inquiry lookup - resolves a bank+account number to the bank's own name on file (Section 11). */
  resolveBankAccount(params: { accountNumber: string; bankCode: string }): Promise<ResolvedBankAccount>;

  /** Sends money out to a verified bank account. Must be called with an idempotency key equal to the withdrawal id. */
  initiatePayout(params: {
    amountMinor: number;
    currency: string;
    destination: ResolvedBankAccount;
    idempotencyKey: string;
  }): Promise<PayoutResult>;

  /** Issues a per-user virtual account for collection (Phase 2+ - not required for withdrawals). */
  createVirtualAccount(params: { userId: string; currency: string }): Promise<VirtualAccount>;

  /** Reads the partner's own reported balance for reconciliation (Section 19/20). */
  getAccountBalance(externalRef: string): Promise<AccountBalance>;
}

export class BaasNotConfiguredError extends Error {
  constructor(providerName: string, method: string) {
    super(
      `${providerName}.${method}() was called, but no banking partner is connected yet. ` +
        `Payouts and virtual accounts aren't live - see src/lib/baas/README for what's needed to turn this on.`,
    );
    this.name = "BaasNotConfiguredError";
  }
}
