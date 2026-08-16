/**
 * Orbit's cut of each invoice payment collected through the wallet.
 * Change this one number to change pricing everywhere it applies -
 * it's read by the Paystack webhook when splitting a payment between
 * the user's wallet and the platform_fee_revenue ledger account.
 */
export const PLATFORM_FEE_PERCENT = 1.5;

/** Splits a total payment (minor units) into what the user keeps vs. Orbit's cut. Fee rounds down in the user's favor. */
export function splitPaymentMinor(totalMinor: number): { userAmountMinor: number; feeAmountMinor: number } {
  const feeAmountMinor = Math.floor((totalMinor * PLATFORM_FEE_PERCENT) / 100);
  return { userAmountMinor: totalMinor - feeAmountMinor, feeAmountMinor };
}
