/**
 * Core calculation functions for financial simulator
 */

import { ExpenseRow, Milestones } from './types';

/**
 * Calculate monthly mortgage payment using French amortization (constant payment)
 * Formula: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
 */
export function calculateMortgagePayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (annualRate === 0) {
    return principal / months;
  }

  const r = annualRate / 12 / 100;
  const numerator = r * Math.pow(1 + r, months);
  const denominator = Math.pow(1 + r, months) - 1;
  return principal * (numerator / denominator);
}

/**
 * Withdraw from assets with priority: Savings → Investments
 * Throws error if insufficient funds
 */
export function withdrawFromAssets(
  amount: number,
  savings: number,
  investments: number
): { savings: number; investments: number } {
  // Priority: Savings → Investments
  if (savings >= amount) {
    savings -= amount;
  } else {
    const fromSavings = savings;
    const fromInvestments = amount - fromSavings;
    savings = 0;

    if (investments >= fromInvestments) {
      investments -= fromInvestments;
    } else {
      throw new Error(
        `Insufficient funds for operation. Required: €${amount.toFixed(
          2
        )}, Available: €${(fromSavings + investments).toFixed(2)}`
      );
    }
  }

  return { savings, investments };
}

/**
 * Calculate real value adjusted for inflation
 */
export function calculateRealValue(
  nominalValue: number,
  inflationRate: number,
  years: number
): number {
  return nominalValue / Math.pow(1 + inflationRate / 100, years);
}

/**
 * Apply monthly compound interest
 */
export function applyMonthlyInterest(
  amount: number,
  annualRate: number
): number {
  return amount * (1 + annualRate / 12 / 100);
}

/**
 * Generate unique ID for assets and debts
 */
let idCounter = 0;
export function generateId(): string {
  return `sim-${Date.now()}-${++idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Interpolate milestone data for a given year
 * Uses linear interpolation between milestone values
 */
export function interpolateMilestone(
  year: number,
  milestones: Milestones
): { salary: number; investment: number } {
  // Define milestone years and their data
  const milestonePoints = [
    { year: 1, data: milestones.year1 },
    { year: 5, data: milestones.year5 },
    { year: 10, data: milestones.year10 },
    { year: 20, data: milestones.year20 },
    { year: 30, data: milestones.year30 },
    { year: 50, data: milestones.year50 },
  ];

  // If year is before first milestone, use first milestone values
  if (year <= 1) {
    return { salary: milestones.year1.salary, investment: milestones.year1.investment ?? 0 };
  }

  // If year is after last milestone, use last milestone values
  if (year >= 50) {
    return { salary: milestones.year50.salary, investment: milestones.year50.investment ?? 0 };
  }

  // Find the two milestones to interpolate between
  let lowerMilestone = milestonePoints[0];
  let upperMilestone = milestonePoints[1];

  for (let i = 0; i < milestonePoints.length - 1; i++) {
    if (year >= milestonePoints[i].year && year <= milestonePoints[i + 1].year) {
      lowerMilestone = milestonePoints[i];
      upperMilestone = milestonePoints[i + 1];
      break;
    }
  }

  // Linear interpolation formula: value = lower + (upper - lower) * ratio
  const ratio =
    (year - lowerMilestone.year) / (upperMilestone.year - lowerMilestone.year);

  const salary =
    lowerMilestone.data.salary +
    (upperMilestone.data.salary - lowerMilestone.data.salary) * ratio;

  const lowerInv = lowerMilestone.data.investment ?? 0;
  const upperInv = upperMilestone.data.investment ?? 0;
  const investment = lowerInv + (upperInv - lowerInv) * ratio;

  return { salary, investment };
}

/**
 * Interpolate total monthly expenses from dynamic expense rows for a given year.
 * Each row is interpolated independently across milestone years (5,10,15,20,30),
 * then all rows are summed to produce total monthly expenses.
 */
export function interpolateExpenses(year: number, expenseRows: ExpenseRow[]): number {
  const milestoneYears = [1, 5, 10, 20, 30, 50];

  let totalExpenses = 0;

  for (const row of expenseRows) {
    const amounts = [
      row.amounts.year1,
      row.amounts.year5,
      row.amounts.year10,
      row.amounts.year20,
      row.amounts.year30,
      row.amounts.year50,
    ];

    // If year <= 1, use year1 value
    if (year <= 1) {
      totalExpenses += amounts[0];
      continue;
    }
    // If year >= 50, use year50 value
    if (year >= 50) {
      totalExpenses += amounts[5];
      continue;
    }

    // Find the two milestones to interpolate between
    let lowerIdx = 0;
    for (let i = 0; i < milestoneYears.length - 1; i++) {
      if (year >= milestoneYears[i] && year <= milestoneYears[i + 1]) {
        lowerIdx = i;
        break;
      }
    }

    const lowerYear = milestoneYears[lowerIdx];
    const upperYear = milestoneYears[lowerIdx + 1];
    const ratio = (year - lowerYear) / (upperYear - lowerYear);

    totalExpenses += amounts[lowerIdx] + (amounts[lowerIdx + 1] - amounts[lowerIdx]) * ratio;
  }

  return totalExpenses;
}
