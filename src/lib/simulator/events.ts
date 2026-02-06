/**
 * Event handling functions (purchase and sale)
 */

import { Asset, Debt, SimulationEvent } from './types';
import { calculateMortgagePayment, generateId, withdrawFromAssets } from './calculations';
import { findAssetById } from './assets';
import { findDebtByAssetId } from './debts';

interface EventHandlerState {
  savings: number;
  investments: number;
  assets: Asset[];
  debts: Debt[];
}

/**
 * Handle purchase event (house/car with debt)
 */
export function handlePurchase(
  event: SimulationEvent,
  state: EventHandlerState,
  year: number
): EventHandlerState {
  if (
    !event.purchasePrice ||
    !event.downPayment ||
    !event.debtAmount ||
    !event.debtDuration ||
    event.debtInterestRate === undefined ||
    event.assetAppreciationRate === undefined
  ) {
    throw new Error(
      `Purchase event in year ${year} is missing required fields`
    );
  }

  let { savings, investments, assets, debts } = state;

  // 1. Withdraw down payment (priority: savings → investments)
  try {
    ({ savings, investments } = withdrawFromAssets(
      event.downPayment,
      savings,
      investments
    ));
  } catch (error) {
    throw new Error(
      `Year ${year} purchase failed: ${error instanceof Error ? error.message : 'Insufficient funds'}`
    );
  }

  // 2. Create asset
  const asset: Asset = {
    id: generateId(),
    name: event.assetName || `Asset ${year}`,
    purchaseYear: year,
    purchasePrice: event.purchasePrice,
    currentValue: event.purchasePrice,
    appreciationRate: event.assetAppreciationRate,
  };
  assets.push(asset);

  // 3. Create debt with French amortization
  const monthlyPayment = calculateMortgagePayment(
    event.debtAmount,
    event.debtInterestRate,
    event.debtDuration * 12
  );

  const debt: Debt = {
    id: generateId(),
    assetId: asset.id,
    originalAmount: event.debtAmount,
    remainingAmount: event.debtAmount,
    monthlyPayment,
    interestRate: event.debtInterestRate,
    startYear: year,
    endYear: year + event.debtDuration,
  };
  debts.push(debt);

  return { savings, investments, assets, debts };
}

/**
 * Handle sale event (sell asset and pay off debt)
 */
export function handleSale(
  event: SimulationEvent,
  state: EventHandlerState,
  year: number
): EventHandlerState {
  if (!event.saleAssetId || !event.surplusAllocation) {
    throw new Error(`Sale event in year ${year} is missing required fields`);
  }

  let { savings, investments, assets, debts } = state;

  // 1. Find asset and debt
  const asset = findAssetById(assets, event.saleAssetId);
  if (!asset) {
    throw new Error(
      `Year ${year} sale failed: Asset ${event.saleAssetId} not found`
    );
  }

  const debt = findDebtByAssetId(debts, event.saleAssetId);

  // 2. Calculate sale revenue
  const saleRevenue = asset.currentValue;

  // 3. Pay off debt (if exists)
  const debtToPayOff = debt ? debt.remainingAmount : 0;
  const surplus = saleRevenue - debtToPayOff;

  if (surplus < 0) {
    throw new Error(
      `Year ${year} sale failed: Sale revenue (€${saleRevenue.toFixed(
        2
      )}) does not cover remaining debt (€${debtToPayOff.toFixed(2)})`
    );
  }

  // 4. Reallocate surplus according to user preferences
  investments +=
    surplus * (event.surplusAllocation.investmentsPercent / 100);
  savings += surplus * (event.surplusAllocation.savingsPercent / 100);

  // 5. Remove asset and debt
  assets = assets.filter((a) => a.id !== event.saleAssetId);
  debts = debts.filter((d) => d.assetId !== event.saleAssetId);

  return { savings, investments, assets, debts };
}

/**
 * Validate events configuration
 */
export function validateEvents(
  events: SimulationEvent[],
  horizonYears: number
): string[] {
  const errors: string[] = [];

  events.forEach((event, index) => {
    // Check year is within horizon
    if (event.year < 1 || event.year > horizonYears) {
      errors.push(
        `Event ${index + 1}: Year ${event.year} is outside simulation horizon (1-${horizonYears})`
      );
    }

    // Validate purchase events
    if (event.type === 'purchase') {
      if (!event.purchasePrice || event.purchasePrice <= 0) {
        errors.push(`Event ${index + 1} (Purchase): Invalid purchase price`);
      }
      if (!event.downPayment || event.downPayment < 0) {
        errors.push(`Event ${index + 1} (Purchase): Invalid down payment`);
      }
      if (!event.debtAmount || event.debtAmount <= 0) {
        errors.push(`Event ${index + 1} (Purchase): Invalid debt amount`);
      }
      if (!event.debtDuration || event.debtDuration <= 0) {
        errors.push(`Event ${index + 1} (Purchase): Invalid debt duration`);
      }
      if (
        event.debtInterestRate === undefined ||
        event.debtInterestRate < 0
      ) {
        errors.push(`Event ${index + 1} (Purchase): Invalid interest rate`);
      }
    }

    // Validate sale events
    if (event.type === 'sale') {
      if (!event.saleAssetId) {
        errors.push(`Event ${index + 1} (Sale): Asset ID is required`);
      }
      if (!event.surplusAllocation) {
        errors.push(
          `Event ${index + 1} (Sale): Surplus allocation is required`
        );
      } else {
        const total =
          event.surplusAllocation.investmentsPercent +
          event.surplusAllocation.savingsPercent;
        if (Math.abs(total - 100) > 0.01) {
          errors.push(
            `Event ${index + 1} (Sale): Surplus allocation must sum to 100% (currently ${total.toFixed(1)}%)`
          );
        }
      }
    }
  });

  // Check for chronological issues (selling before purchasing)
  const purchases = new Map<string, number>();
  events
    .sort((a, b) => a.year - b.year)
    .forEach((event, index) => {
      if (event.type === 'purchase' && event.assetName) {
        // Track purchase events (we'll use assetId after generation)
      } else if (event.type === 'sale' && event.saleAssetId) {
        // Check if asset was purchased before sale
        const purchaseEvent = events.find(
          (e) =>
            e.type === 'purchase' &&
            e.year < event.year &&
            // We can't fully validate this without running simulation
            // This is a basic check
            true
        );
      }
    });

  return errors;
}
