/**
 * Financial calculation utilities
 */

export interface Transaction {
  type: 'income' | 'expense';
  amount: number;
}

export interface UserSettings {
  savings_percentage: number;
  investments_percentage: number;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  savings: number;
  investments: number;
}

/**
 * Calculate net income from transactions
 * Formula: Total Income - Total Expenses
 */
export function calculateNetIncome(transactions: Transaction[]): number {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return totalIncome - totalExpenses;
}

/**
 * Calculate savings and investments based on net income and user settings
 * Formula:
 * - Risparmio = Netto × (savings_percentage / 100)
 * - Investimenti = Netto × (investments_percentage / 100)
 */
export function calculateSavingsAndInvestments(
  netIncome: number,
  settings: UserSettings
): { savings: number; investments: number } {
  // Only calculate if net is positive
  if (netIncome <= 0) {
    return { savings: 0, investments: 0 };
  }

  const savings = netIncome * (settings.savings_percentage / 100);
  const investments = netIncome * (settings.investments_percentage / 100);

  return {
    savings: Math.round(savings * 100) / 100, // Round to 2 decimals
    investments: Math.round(investments * 100) / 100,
  };
}

/**
 * Calculate complete monthly summary
 */
export function calculateMonthlySummary(
  transactions: Transaction[],
  settings: UserSettings
): MonthlySummary {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const net = totalIncome - totalExpenses;
  const { savings, investments } = calculateSavingsAndInvestments(net, settings);

  return {
    totalIncome,
    totalExpenses,
    net,
    savings,
    investments,
  };
}
