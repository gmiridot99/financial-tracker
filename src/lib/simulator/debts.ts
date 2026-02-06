/**
 * Debt management and amortization functions
 */

import { Debt } from './types';

/**
 * Update all debts with monthly amortization (French method)
 * Returns updated debts array with extinct debts removed
 * Creates new objects to avoid reference issues
 */
export function updateDebts(debts: Debt[]): Debt[] {
  return debts
    .map((debt) => {
      // Calculate monthly interest on remaining debt
      const monthlyInterest =
        debt.remainingAmount * (debt.interestRate / 100 / 12);

      // Calculate principal payment (payment - interest)
      const principalPayment = debt.monthlyPayment - monthlyInterest;

      // Create new debt object with updated remaining amount
      return {
        ...debt,
        remainingAmount: Math.max(0, debt.remainingAmount - principalPayment),
      };
    })
    .filter((d) => d.remainingAmount > 0.01); // Remove extinct debts (with small tolerance)
}

/**
 * Calculate total monthly debt payments
 */
export function calculateTotalDebtPayments(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
}

/**
 * Find debt associated with an asset
 */
export function findDebtByAssetId(
  debts: Debt[],
  assetId: string
): Debt | undefined {
  return debts.find((d) => d.assetId === assetId);
}
