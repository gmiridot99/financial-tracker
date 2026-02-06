/**
 * Financial Simulator Type Definitions
 * Multi-decade wealth simulation with milestone-based approach
 */

export interface SimulationConfig {
  // Initial state
  initialSavings: number;
  initialInvestments: number;
  horizonYears: number; // always 50
  inflationRate: number; // % per year (e.g., 2)
  startYear?: number; // e.g., 2026 - used for display only

  // NEW: Global allocation (applies to entire simulation in milestone mode)
  allocationInvestments?: number; // % (0-100)
  allocationSavings?: number; // % (0-100), sum = 100
  investmentReturnRate?: number; // % annual
  savingsReturnRate?: number; // % annual

  // NEW: Milestone data (fixed columns: 5, 10, 15, 20, 30)
  milestones?: Milestones;

  // NEW: Debts (simple list)
  debts?: DebtInput[];

  // NEW: Dynamic expense rows
  expenseRows?: ExpenseRow[];

  // LEGACY: Temporal phases
  phases?: Phase[];

  // LEGACY: Punctual events
  events?: SimulationEvent[];
}

export interface Milestones {
  year1: MilestoneData;
  year5: MilestoneData;
  year10: MilestoneData;
  year20: MilestoneData;
  year30: MilestoneData;
  year50: MilestoneData;
}

export interface MilestoneData {
  salary: number; // monthly salary at this milestone
}

export interface ExpenseRow {
  id: string;
  label: string; // "Affitto", "Benzina", "Bollette", etc.
  amounts: {
    year1: number;
    year5: number;
    year10: number;
    year20: number;
    year30: number;
    year50: number;
  };
}

export interface DebtInput {
  id: string;
  name: string; // "Casa Milano", "Auto Fiat"
  year: number; // when purchased
  totalValue: number; // 300,000
  cashPayment: number; // 60,000
  debtAmount: number; // 240,000 (calculated: totalValue - cashPayment)
  interestRate: number; // 3.0%
  durationYears: number; // 30
  appreciationRate?: number; // 2.0% (only for real estate)
  sale?: {
    year: number; // When to sell (must be > purchase year)
    salePrice: number; // Expected sale price
    allocationInvestments: number; // % of surplus to investments (0-100)
    allocationSavings: number; // % of surplus to savings (0-100), sum=100
  };
}

// Legacy types kept for backward compatibility
export interface Phase {
  startYear: number; // e.g., 1
  endYear: number; // e.g., 10
  monthlyIncome: number; // nominal fixed
  monthlyExpenses: number; // nominal fixed
  allocationInvestments: number; // % (0-100)
  allocationSavings: number; // % (0-100), sum = 100
  investmentReturnRate: number; // % annual
  savingsReturnRate: number; // % annual
}

export interface SimulationEvent {
  year: number;
  type: 'purchase' | 'sale';

  // For purchase (house/car)
  purchasePrice?: number;
  downPayment?: number;
  debtAmount?: number;
  debtDuration?: number; // years
  debtInterestRate?: number; // %
  assetAppreciationRate?: number; // %/year
  assetName?: string; // "Casa Milano", "Auto Tesla"

  // For sale
  saleAssetId?: string; // which asset to sell
  surplusAllocation?: {
    investmentsPercent: number;
    savingsPercent: number;
  };
}

export interface SimulationResult {
  yearlySnapshots: YearSnapshot[];
  finalWealth: WealthSummary;
}

export interface YearSnapshot {
  year: number;

  // Liquid assets
  investments: number;
  savings: number;

  // Illiquid assets
  assets: Asset[]; // houses, cars, etc.

  // Liabilities
  debts: Debt[];

  // Cash flow
  monthlyIncome: number; // nominal
  monthlyExpenses: number; // nominal
  monthlyDebtPayments: number; // sum of payments
  netCashFlow: number; // income - expenses - debtPayments

  // Wealth
  totalAssets: number; // investments + savings + asset values
  totalDebts: number; // sum of remaining debts
  netWealth: number; // totalAssets - totalDebts
  realWealth: number; // netWealth / (1 + inflation)^years
}

export interface Asset {
  id: string;
  name: string; // "Casa Milano"
  purchaseYear: number;
  purchasePrice: number;
  currentValue: number; // appreciated value
  appreciationRate: number; // %/year
}

export interface Debt {
  id: string;
  assetId: string; // linked to which asset
  originalAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate: number; // % annual
  startYear: number;
  endYear: number;
}

export interface WealthSummary {
  investments: number;
  savings: number;
  assetsValue: number;
  totalDebts: number;
  netWealth: number;
  realWealth: number; // inflation corrected
}
