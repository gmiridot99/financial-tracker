/**
 * Main simulation engine
 * Multi-decade financial simulator with phases, events, and compound growth
 */

import {
  SimulationConfig,
  SimulationResult,
  YearSnapshot,
  WealthSummary,
  Asset,
  Debt,
  DebtInput,
} from './types';
import { getCurrentPhase, validatePhases } from './phases';
import { handlePurchase, handleSale, validateEvents } from './events';
import { appreciateAssets, calculateTotalAssetsValue } from './assets';
import { updateDebts, calculateTotalDebtPayments } from './debts';
import {
  withdrawFromAssets,
  calculateRealValue,
  applyMonthlyInterest,
  interpolateMilestone,
  interpolateExpenses,
  calculateMortgagePayment,
  generateId,
} from './calculations';

// --- Private types for shared monthly simulation ---

interface MonthlyState {
  savings: number;
  investments: number;
  debts: Debt[];
}

interface MonthlyParams {
  netCashFlow: number;
  investmentReturnRate: number;
  savingsReturnRate: number;
  allocateSurplus: (availableCashFlow: number) => { toInvestments: number; toSavings: number };
}

/**
 * Simulate a single month of cash flow, debt payments, surplus allocation, and interest.
 * Shared by both legacy and milestone engines. Does not throw user-facing errors.
 */
function simulateMonth(state: MonthlyState, params: MonthlyParams): MonthlyState {
  let { savings, investments } = state;
  const debts = [...state.debts]; // shallow clone so caller's array is not mutated

  // Calculate total debt payments
  const monthlyDebtPayments = calculateTotalDebtPayments(debts);

  // Available cash flow after debt payments
  const availableCashFlow = params.netCashFlow - monthlyDebtPayments;

  if (availableCashFlow < 0) {
    ({ savings, investments } = withdrawFromAssets(
      Math.abs(availableCashFlow),
      savings,
      investments
    ));
  } else {
    const { toInvestments, toSavings } = params.allocateSurplus(availableCashFlow);
    investments += toInvestments;
    savings += toSavings;
  }

  // Apply monthly compound interest
  investments = applyMonthlyInterest(investments, params.investmentReturnRate);
  savings = applyMonthlyInterest(savings, params.savingsReturnRate);

  // Update debts (amortization)
  const updatedDebts = updateDebts(debts);

  return { savings, investments, debts: updatedDebts };
}

/**
 * Run complete financial simulation
 * Supports both legacy phase-based and new milestone-based configs
 */
export function simulate(config: SimulationConfig): SimulationResult {
  // Detect which mode we're in
  const isLegacyMode = 'phases' in config && Array.isArray(config.phases);
  const isMilestoneMode = 'milestones' in config && config.milestones;

  if (isLegacyMode) {
    return simulateLegacy(config);
  } else if (isMilestoneMode) {
    return simulateMilestone(config);
  } else {
    throw new Error('Invalid configuration: must have either phases or milestones');
  }
}

/**
 * Legacy phase-based simulation
 */
function simulateLegacy(config: SimulationConfig): SimulationResult {
  // Validate configuration
  const phaseErrors = validatePhases(config.phases || []);
  if (phaseErrors.length > 0) {
    throw new Error(`Phase validation failed:\n${phaseErrors.join('\n')}`);
  }

  const eventErrors = validateEvents(config.events || [], config.horizonYears);
  if (eventErrors.length > 0) {
    throw new Error(`Event validation failed:\n${eventErrors.join('\n')}`);
  }

  // Initialize state
  let savings = config.initialSavings;
  let investments = config.initialInvestments;
  let assets: Asset[] = [];
  let debts: Debt[] = [];
  const snapshots: YearSnapshot[] = [];

  // Simulate each year
  for (let year = 1; year <= config.horizonYears; year++) {
    // 1. Find current phase
    const phase = getCurrentPhase(config.phases || [], year);

    // 2. Handle events at start of year
    const yearEvents = (config.events || []).filter((e) => e.year === year);
    for (const event of yearEvents) {
      try {
        if (event.type === 'purchase') {
          ({ savings, investments, assets, debts } = handlePurchase(
            event,
            { savings, investments, assets, debts },
            year
          ));
        } else if (event.type === 'sale') {
          ({ savings, investments, assets, debts } = handleSale(
            event,
            { savings, investments, assets, debts },
            year
          ));
        }
      } catch (error) {
        throw new Error(
          `Simulation failed at year ${year}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // 3. Simulate 12 months
    for (let month = 1; month <= 12; month++) {
      try {
        const result = simulateMonth(
          { savings, investments, debts },
          {
            netCashFlow: phase.monthlyIncome - phase.monthlyExpenses,
            investmentReturnRate: phase.investmentReturnRate,
            savingsReturnRate: phase.savingsReturnRate,
            allocateSurplus: (available) => ({
              toInvestments: available * (phase.allocationInvestments / 100),
              toSavings: available * (phase.allocationSavings / 100),
            }),
          }
        );
        savings = result.savings;
        investments = result.investments;
        debts = result.debts;
      } catch (error) {
        throw new Error(
          `Simulation failed at year ${year}, month ${month}: ${
            error instanceof Error ? error.message : 'Cash flow deficit exceeded available reserves'
          }`
        );
      }
    }
    const monthlyDebtPayments = calculateTotalDebtPayments(debts);

    // 4. Appreciate assets (end of year)
    assets = appreciateAssets(assets);

    // 5. Create year snapshot
    const snapshot = createYearSnapshot(
      year,
      investments,
      savings,
      assets,
      debts,
      phase.monthlyIncome,
      phase.monthlyExpenses,
      monthlyDebtPayments,
      config.inflationRate
    );
    snapshots.push(snapshot);
  }

  // Calculate final wealth
  const finalSnapshot = snapshots[snapshots.length - 1];
  const finalWealth = calculateFinalWealth(finalSnapshot);

  return {
    yearlySnapshots: snapshots,
    finalWealth,
  };
}

/**
 * New milestone-based simulation
 */
function simulateMilestone(config: SimulationConfig): SimulationResult {
  // Initialize state
  let savings = config.initialSavings;
  let investments = config.initialInvestments;
  let assets: Asset[] = [];
  let debts: Debt[] = [];
  const snapshots: YearSnapshot[] = [];

  // Convert DebtInputs to active debts and assets at start
  const activeDebts = new Map<string, Debt>();
  const activeAssets = new Map<string, Asset>();

  // Simulate each year
  for (let year = 1; year <= config.horizonYears; year++) {
    // 1. Get interpolated milestone data for this year
    if (!config.milestones) {
      throw new Error('Milestones configuration is required for milestone-based simulation');
    }
    const milestone = interpolateMilestone(year, config.milestones);

    // 2. Handle debt purchases at start of year
    const yearDebts = (config.debts || []).filter((d) => d.year === year);
    for (const debtInput of yearDebts) {
      // Pre-check affordability before attempting withdrawal
      const availableFunds = savings + investments;
      if (debtInput.cashPayment > availableFunds) {
        const shortage = debtInput.cashPayment - availableFunds;
        const displayYear = config.startYear ? config.startYear + year - 1 : year;
        throw new Error(
          `Fondi insufficienti per "${debtInput.name}" nell'anno ${displayYear}.\n` +
          `Pagamento cash richiesto: €${debtInput.cashPayment.toLocaleString()}\n` +
          `Savings disponibili: €${Math.round(savings).toLocaleString()}\n` +
          `Investments disponibili: €${Math.round(investments).toLocaleString()}\n` +
          `Totale disponibile: €${Math.round(availableFunds).toLocaleString()}\n` +
          `Mancano: €${Math.round(shortage).toLocaleString()}`
        );
      }

      try {
        // Deduct cash payment (savings first, then investments)
        ({ savings, investments } = withdrawFromAssets(
          debtInput.cashPayment,
          savings,
          investments
        ));

        // Create asset
        const asset: Asset = {
          id: debtInput.id,
          name: debtInput.name,
          purchaseYear: year,
          purchasePrice: debtInput.totalValue,
          currentValue: debtInput.totalValue,
          appreciationRate: debtInput.appreciationRate || 0,
        };
        activeAssets.set(asset.id, asset);

        // Create debt
        if (debtInput.debtAmount > 0) {
          const monthlyPayment = calculateMortgagePayment(
            debtInput.debtAmount,
            debtInput.interestRate,
            debtInput.durationYears * 12
          );

          const debt: Debt = {
            id: generateId(),
            assetId: debtInput.id,
            originalAmount: debtInput.debtAmount,
            remainingAmount: debtInput.debtAmount,
            monthlyPayment,
            interestRate: debtInput.interestRate,
            startYear: year,
            endYear: year + debtInput.durationYears,
          };
          activeDebts.set(debt.id, debt);
        }
      } catch (error) {
        throw new Error(
          `Failed to process debt "${debtInput.name}" at year ${year}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // Handle asset sales at start of year
    const yearSales = (config.debts || []).filter((d) => d.sale && d.sale.year === year);
    for (const debtInput of yearSales) {
      const sale = debtInput.sale!;

      // Find the asset
      const asset = activeAssets.get(debtInput.id);
      if (!asset) continue;

      // Find remaining debt for this asset
      let remainingDebt = 0;
      const debtToRemove: string[] = [];
      activeDebts.forEach((debt, debtId) => {
        if (debt.assetId === debtInput.id) {
          remainingDebt += debt.remainingAmount;
          debtToRemove.push(debtId);
        }
      });

      // Calculate surplus after paying off debt
      const surplus = Math.max(0, sale.salePrice - remainingDebt);

      // If sale price doesn't cover debt, the shortfall comes from reserves
      if (sale.salePrice < remainingDebt) {
        const shortfall = remainingDebt - sale.salePrice;
        ({ savings, investments } = withdrawFromAssets(shortfall, savings, investments));
      }

      // Distribute surplus
      if (surplus > 0) {
        investments += surplus * (sale.allocationInvestments / 100);
        savings += surplus * (sale.allocationSavings / 100);
      }

      // Remove asset and debt
      activeAssets.delete(debtInput.id);
      debtToRemove.forEach(id => activeDebts.delete(id));
    }

    // Convert maps to arrays for processing
    assets = Array.from(activeAssets.values());
    debts = Array.from(activeDebts.values());

    // 3. Calculate total expenses from dynamic expense rows
    const totalExpenses = interpolateExpenses(year, config.expenseRows || []);

    // 4. Simulate 12 months
    const monthlyInvestment = milestone.investment ?? 0;
    for (let month = 1; month <= 12; month++) {
      try {
        const result = simulateMonth(
          { savings, investments, debts },
          {
            netCashFlow: milestone.salary - totalExpenses,
            investmentReturnRate: config.investmentReturnRate ?? 7,
            savingsReturnRate: config.savingsReturnRate ?? 1,
            allocateSurplus: (available) => {
              const toInvestments = Math.min(monthlyInvestment, available);
              return { toInvestments, toSavings: available - toInvestments };
            },
          }
        );
        savings = result.savings;
        investments = result.investments;
        debts = result.debts;
      } catch (error) {
        throw new Error(
          `Simulation failed at year ${year}, month ${month}: ${
            error instanceof Error ? error.message : 'Cash flow deficit exceeded available reserves'
          }`
        );
      }

      // Update map
      activeDebts.clear();
      debts.forEach(d => activeDebts.set(d.id, d));
    }
    const monthlyDebtPayments = calculateTotalDebtPayments(debts);

    // 5. Appreciate assets (end of year)
    assets = appreciateAssets(assets);

    // Update map
    activeAssets.clear();
    assets.forEach(a => activeAssets.set(a.id, a));

    // 6. Create year snapshot
    const snapshot = createYearSnapshot(
      year,
      investments,
      savings,
      assets,
      debts,
      milestone.salary,
      totalExpenses,
      monthlyDebtPayments,
      config.inflationRate
    );
    snapshots.push(snapshot);
  }

  // Calculate final wealth
  const finalSnapshot = snapshots[snapshots.length - 1];
  const finalWealth = calculateFinalWealth(finalSnapshot);

  return {
    yearlySnapshots: snapshots,
    finalWealth,
  };
}

/**
 * Create snapshot for a specific year
 */
function createYearSnapshot(
  year: number,
  investments: number,
  savings: number,
  assets: Asset[],
  debts: Debt[],
  monthlyIncome: number,
  monthlyExpenses: number,
  monthlyDebtPayments: number,
  inflationRate: number
): YearSnapshot {
  const totalAssetsValue = calculateTotalAssetsValue(assets);
  const totalAssets = investments + savings + totalAssetsValue;
  const totalDebts = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const netWealth = totalAssets - totalDebts;
  const realWealth = calculateRealValue(netWealth, inflationRate, year);

  return {
    year,
    investments,
    savings,
    assets: [...assets], // Clone array
    debts: [...debts], // Clone array
    monthlyIncome,
    monthlyExpenses,
    monthlyDebtPayments,
    netCashFlow: monthlyIncome - monthlyExpenses - monthlyDebtPayments,
    totalAssets,
    totalDebts,
    netWealth,
    realWealth,
  };
}

/**
 * Calculate final wealth summary
 */
function calculateFinalWealth(snapshot: YearSnapshot): WealthSummary {
  const assetsValue = calculateTotalAssetsValue(snapshot.assets);

  return {
    investments: snapshot.investments,
    savings: snapshot.savings,
    assetsValue,
    totalDebts: snapshot.totalDebts,
    netWealth: snapshot.netWealth,
    realWealth: snapshot.realWealth,
  };
}
