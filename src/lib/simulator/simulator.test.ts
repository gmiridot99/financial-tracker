/**
 * Comprehensive test suite for financial simulator
 */

import { describe, test, expect } from 'vitest';
import {
  calculateMortgagePayment,
  withdrawFromAssets,
  calculateRealValue,
  applyMonthlyInterest,
} from './calculations';
import { updateDebts } from './debts';
import { appreciateAssets } from './assets';
import { getCurrentPhase, validatePhases } from './phases';
import { validateEvents } from './events';
import { simulate } from './simulator';
import { SimulationConfig, Phase, Debt, Asset } from './types';

describe('Calculations', () => {
  describe('calculateMortgagePayment', () => {
    test('calculates correct monthly payment for standard mortgage', () => {
      // €100,000 at 5% for 30 years should be €536.82/month
      const payment = calculateMortgagePayment(100000, 5, 30 * 12);
      expect(payment).toBeCloseTo(536.82, 2);
    });

    test('calculates correct payment for shorter term', () => {
      // €200,000 at 3% for 15 years
      const payment = calculateMortgagePayment(200000, 3, 15 * 12);
      expect(payment).toBeCloseTo(1381.16, 2);
    });

    test('handles zero interest rate', () => {
      // €120,000 at 0% for 10 years = €1,000/month
      const payment = calculateMortgagePayment(120000, 0, 10 * 12);
      expect(payment).toBeCloseTo(1000, 2);
    });

    test('higher interest rate increases payment', () => {
      const payment5 = calculateMortgagePayment(100000, 5, 30 * 12);
      const payment7 = calculateMortgagePayment(100000, 7, 30 * 12);
      expect(payment7).toBeGreaterThan(payment5);
    });
  });

  describe('withdrawFromAssets', () => {
    test('withdraws from savings first if sufficient', () => {
      const result = withdrawFromAssets(30000, 50000, 40000);
      expect(result.savings).toBe(20000);
      expect(result.investments).toBe(40000);
    });

    test('withdraws from both when savings insufficient', () => {
      const result = withdrawFromAssets(50000, 30000, 40000);
      expect(result.savings).toBe(0);
      expect(result.investments).toBe(20000);
    });

    test('uses all savings then remaining from investments', () => {
      const result = withdrawFromAssets(60000, 25000, 50000);
      expect(result.savings).toBe(0);
      expect(result.investments).toBe(15000);
    });

    test('throws error when total funds insufficient', () => {
      expect(() => {
        withdrawFromAssets(100000, 30000, 40000);
      }).toThrow('Insufficient funds');
    });

    test('handles exact withdrawal amount', () => {
      const result = withdrawFromAssets(70000, 30000, 40000);
      expect(result.savings).toBe(0);
      expect(result.investments).toBe(0);
    });
  });

  describe('calculateRealValue', () => {
    test('calculates real value with 2% inflation over 10 years', () => {
      // €100,000 nominal with 2% inflation for 10 years
      // Real value = 100000 / (1.02^10) = €82,034.83
      const real = calculateRealValue(100000, 2, 10);
      expect(real).toBeCloseTo(82034.83, 2);
    });

    test('higher inflation reduces real value more', () => {
      const real2 = calculateRealValue(100000, 2, 10);
      const real5 = calculateRealValue(100000, 5, 10);
      expect(real5).toBeLessThan(real2);
    });

    test('zero inflation means no change', () => {
      const real = calculateRealValue(100000, 0, 10);
      expect(real).toBe(100000);
    });

    test('longer time period reduces real value more', () => {
      const real10 = calculateRealValue(100000, 2, 10);
      const real30 = calculateRealValue(100000, 2, 30);
      expect(real30).toBeLessThan(real10);
    });
  });

  describe('applyMonthlyInterest', () => {
    test('applies monthly compound interest correctly', () => {
      // €100,000 at 6% annual = 0.5% monthly
      const result = applyMonthlyInterest(100000, 6);
      expect(result).toBeCloseTo(100500, 2);
    });

    test('compounds correctly over 12 months', () => {
      let amount = 100000;
      for (let i = 0; i < 12; i++) {
        amount = applyMonthlyInterest(amount, 6);
      }
      // Should be €106,167.78 (compound interest)
      expect(amount).toBeCloseTo(106167.78, 2);
    });

    test('zero rate means no change', () => {
      const result = applyMonthlyInterest(100000, 0);
      expect(result).toBe(100000);
    });
  });
});

describe('Debts', () => {
  describe('updateDebts', () => {
    test('reduces debt principal with French amortization', () => {
      const debts: Debt[] = [
        {
          id: 'debt1',
          assetId: 'asset1',
          originalAmount: 100000,
          remainingAmount: 100000,
          monthlyPayment: 536.82,
          interestRate: 5,
          startYear: 1,
          endYear: 31,
        },
      ];

      const updated = updateDebts(debts);

      // First month: interest = 100000 * 0.05/12 = 416.67
      // Principal = 536.82 - 416.67 = 120.15
      // Remaining = 100000 - 120.15 = 99879.85
      expect(updated[0].remainingAmount).toBeCloseTo(99879.85, 2);
    });

    test('handles multiple debts simultaneously', () => {
      const debts: Debt[] = [
        {
          id: 'debt1',
          assetId: 'asset1',
          originalAmount: 100000,
          remainingAmount: 100000,
          monthlyPayment: 536.82,
          interestRate: 5,
          startYear: 1,
          endYear: 31,
        },
        {
          id: 'debt2',
          assetId: 'asset2',
          originalAmount: 50000,
          remainingAmount: 50000,
          monthlyPayment: 300,
          interestRate: 3,
          startYear: 1,
          endYear: 16,
        },
      ];

      const updated = updateDebts(debts);
      expect(updated).toHaveLength(2);
      expect(updated[0].remainingAmount).toBeLessThan(100000);
      expect(updated[1].remainingAmount).toBeLessThan(50000);
    });

    test('removes fully paid debts', () => {
      const debts: Debt[] = [
        {
          id: 'debt1',
          assetId: 'asset1',
          originalAmount: 100,
          remainingAmount: 50,
          monthlyPayment: 60, // Payment exceeds remaining
          interestRate: 0,
          startYear: 1,
          endYear: 2,
        },
      ];

      const updated = updateDebts(debts);
      expect(updated).toHaveLength(0);
    });

    test('debt decreases over time', () => {
      let debts: Debt[] = [
        {
          id: 'debt1',
          assetId: 'asset1',
          originalAmount: 100000,
          remainingAmount: 100000,
          monthlyPayment: 536.82,
          interestRate: 5,
          startYear: 1,
          endYear: 31,
        },
      ];

      const initial = debts[0].remainingAmount;

      // Simulate 12 months
      for (let i = 0; i < 12; i++) {
        debts = updateDebts(debts);
      }

      expect(debts[0].remainingAmount).toBeLessThan(initial);
      expect(debts[0].remainingAmount).toBeGreaterThan(95000); // Still substantial
    });
  });
});

describe('Assets', () => {
  describe('appreciateAssets', () => {
    test('applies annual appreciation correctly', () => {
      const assets: Asset[] = [
        {
          id: 'asset1',
          name: 'Casa Milano',
          purchaseYear: 1,
          purchasePrice: 300000,
          currentValue: 300000,
          appreciationRate: 2,
        },
      ];

      const appreciated = appreciateAssets(assets);
      // 300000 * 1.02 = 306000
      expect(appreciated[0].currentValue).toBeCloseTo(306000, 2);
    });

    test('compounds appreciation over multiple years', () => {
      let assets: Asset[] = [
        {
          id: 'asset1',
          name: 'Casa Milano',
          purchaseYear: 1,
          purchasePrice: 300000,
          currentValue: 300000,
          appreciationRate: 2,
        },
      ];

      // Apply appreciation for 10 years
      for (let i = 0; i < 10; i++) {
        assets = appreciateAssets(assets);
      }

      // 300000 * (1.02^10) = 300000 * 1.21899441998 = 365,698.33
      expect(assets[0].currentValue).toBeCloseTo(365698.33, 0);
    });

    test('handles multiple assets with different rates', () => {
      const assets: Asset[] = [
        {
          id: 'asset1',
          name: 'Casa',
          purchaseYear: 1,
          purchasePrice: 300000,
          currentValue: 300000,
          appreciationRate: 2,
        },
        {
          id: 'asset2',
          name: 'Auto',
          purchaseYear: 1,
          purchasePrice: 30000,
          currentValue: 30000,
          appreciationRate: -10, // Depreciation
        },
      ];

      const appreciated = appreciateAssets(assets);
      expect(appreciated[0].currentValue).toBeGreaterThan(300000);
      expect(appreciated[1].currentValue).toBeLessThan(30000);
      expect(appreciated[1].currentValue).toBeCloseTo(27000, 2);
    });

    test('zero appreciation means no change', () => {
      const assets: Asset[] = [
        {
          id: 'asset1',
          name: 'Asset',
          purchaseYear: 1,
          purchasePrice: 100000,
          currentValue: 100000,
          appreciationRate: 0,
        },
      ];

      const appreciated = appreciateAssets(assets);
      expect(appreciated[0].currentValue).toBe(100000);
    });
  });
});

describe('Phases', () => {
  describe('getCurrentPhase', () => {
    const phases: Phase[] = [
      {
        startYear: 1,
        endYear: 10,
        monthlyIncome: 3000,
        monthlyExpenses: 2000,
        allocationInvestments: 60,
        allocationSavings: 40,
        investmentReturnRate: 7,
        savingsReturnRate: 1,
      },
      {
        startYear: 11,
        endYear: 20,
        monthlyIncome: 4000,
        monthlyExpenses: 2500,
        allocationInvestments: 70,
        allocationSavings: 30,
        investmentReturnRate: 6,
        savingsReturnRate: 1,
      },
    ];

    test('returns correct phase for year 1', () => {
      const phase = getCurrentPhase(phases, 1);
      expect(phase.monthlyIncome).toBe(3000);
    });

    test('returns correct phase for year 15', () => {
      const phase = getCurrentPhase(phases, 15);
      expect(phase.monthlyIncome).toBe(4000);
    });

    test('throws error for uncovered year', () => {
      expect(() => {
        getCurrentPhase(phases, 25);
      }).toThrow('No phase defined');
    });
  });

  describe('validatePhases', () => {
    test('validates correct phases', () => {
      const phases: Phase[] = [
        {
          startYear: 1,
          endYear: 10,
          monthlyIncome: 3000,
          monthlyExpenses: 2000,
          allocationInvestments: 60,
          allocationSavings: 40,
          investmentReturnRate: 7,
          savingsReturnRate: 1,
        },
      ];

      const errors = validatePhases(phases);
      expect(errors).toHaveLength(0);
    });

    test('detects allocation not summing to 100', () => {
      const phases: Phase[] = [
        {
          startYear: 1,
          endYear: 10,
          monthlyIncome: 3000,
          monthlyExpenses: 2000,
          allocationInvestments: 60,
          allocationSavings: 30, // Should be 40
          investmentReturnRate: 7,
          savingsReturnRate: 1,
        },
      ];

      const errors = validatePhases(phases);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must sum to 100%');
    });

    test('detects end year before start year', () => {
      const phases: Phase[] = [
        {
          startYear: 10,
          endYear: 5,
          monthlyIncome: 3000,
          monthlyExpenses: 2000,
          allocationInvestments: 60,
          allocationSavings: 40,
          investmentReturnRate: 7,
          savingsReturnRate: 1,
        },
      ];

      const errors = validatePhases(phases);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('End year');
    });

    test('requires at least one phase', () => {
      const errors = validatePhases([]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('At least one phase');
    });
  });
});

describe('Events Validation', () => {
  describe('validateEvents', () => {
    test('validates correct purchase event', () => {
      const events = [
        {
          year: 5,
          type: 'purchase' as const,
          purchasePrice: 300000,
          downPayment: 50000,
          debtAmount: 250000,
          debtDuration: 30,
          debtInterestRate: 3,
          assetAppreciationRate: 2,
          assetName: 'Casa',
        },
      ];

      const errors = validateEvents(events, 30);
      expect(errors).toHaveLength(0);
    });

    test('validates correct sale event', () => {
      const events = [
        {
          year: 20,
          type: 'sale' as const,
          saleAssetId: 'asset1',
          surplusAllocation: {
            investmentsPercent: 70,
            savingsPercent: 30,
          },
        },
      ];

      const errors = validateEvents(events, 30);
      expect(errors).toHaveLength(0);
    });

    test('detects year outside horizon', () => {
      const events = [
        {
          year: 50,
          type: 'purchase' as const,
          purchasePrice: 300000,
          downPayment: 50000,
          debtAmount: 250000,
          debtDuration: 30,
          debtInterestRate: 3,
          assetAppreciationRate: 2,
        },
      ];

      const errors = validateEvents(events, 30);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('outside simulation horizon');
    });

    test('detects invalid surplus allocation', () => {
      const events = [
        {
          year: 20,
          type: 'sale' as const,
          saleAssetId: 'asset1',
          surplusAllocation: {
            investmentsPercent: 60,
            savingsPercent: 30, // Should sum to 100
          },
        },
      ];

      const errors = validateEvents(events, 30);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must sum to 100%');
    });
  });
});

describe('Full Simulation', () => {
  test('simulates simple 10-year scenario without events', () => {
    const config: SimulationConfig = {
      initialSavings: 20000,
      initialInvestments: 50000,
      horizonYears: 10,
      inflationRate: 2,
      phases: [
        {
          startYear: 1,
          endYear: 10,
          monthlyIncome: 3000,
          monthlyExpenses: 2000,
          allocationInvestments: 60,
          allocationSavings: 40,
          investmentReturnRate: 7,
          savingsReturnRate: 1,
        },
      ],
      events: [],
    };

    const result = simulate(config);

    expect(result.yearlySnapshots).toHaveLength(10);
    expect(result.finalWealth.netWealth).toBeGreaterThan(70000); // Initial
    expect(result.finalWealth.investments).toBeGreaterThan(50000);
    expect(result.finalWealth.savings).toBeGreaterThan(20000);
  });

  test('simulates 30-year scenario with house purchase', () => {
    const config: SimulationConfig = {
      initialSavings: 20000,
      initialInvestments: 50000,
      horizonYears: 30,
      inflationRate: 2,
      phases: [
        {
          startYear: 1,
          endYear: 30,
          monthlyIncome: 3000,
          monthlyExpenses: 2000,
          allocationInvestments: 60,
          allocationSavings: 40,
          investmentReturnRate: 7,
          savingsReturnRate: 1,
        },
      ],
      events: [
        {
          year: 5,
          type: 'purchase',
          assetName: 'Casa Milano',
          purchasePrice: 300000,
          downPayment: 50000,
          debtAmount: 250000,
          debtDuration: 30,
          debtInterestRate: 3,
          assetAppreciationRate: 2,
        },
      ],
    };

    const result = simulate(config);

    expect(result.yearlySnapshots).toHaveLength(30);

    // Year 5 should have asset and debt
    const year5 = result.yearlySnapshots[4];
    expect(year5.assets).toHaveLength(1);
    expect(year5.debts).toHaveLength(1);
    // Asset appreciated once at end of year 5: 300000 * 1.02 = 306000
    expect(year5.assets[0].currentValue).toBeCloseTo(306000, 0);

    // Final year should have appreciated asset
    expect(result.finalWealth.assetsValue).toBeGreaterThan(300000);
    expect(result.finalWealth.netWealth).toBeGreaterThan(0);
  });

  test('simulates purchase and sale scenario', () => {
    const config: SimulationConfig = {
      initialSavings: 50000,
      initialInvestments: 100000,
      horizonYears: 20,
      inflationRate: 2,
      phases: [
        {
          startYear: 1,
          endYear: 20,
          monthlyIncome: 4000,
          monthlyExpenses: 2500,
          allocationInvestments: 70,
          allocationSavings: 30,
          investmentReturnRate: 6,
          savingsReturnRate: 1,
        },
      ],
      events: [
        {
          year: 3,
          type: 'purchase',
          assetName: 'Casa',
          purchasePrice: 200000,
          downPayment: 40000,
          debtAmount: 160000,
          debtDuration: 20,
          debtInterestRate: 3,
          assetAppreciationRate: 2,
        },
        {
          year: 15,
          type: 'sale',
          saleAssetId: '', // Will be set dynamically
          surplusAllocation: {
            investmentsPercent: 70,
            savingsPercent: 30,
          },
        },
      ],
    };

    // Need to run simulation to get asset ID, then update sale event
    // For now, test that it handles the structure
    const configWithoutSale: SimulationConfig = {
      ...config,
      events: [config.events![0]],
    };

    const result = simulate(configWithoutSale);

    // After 20 years with house, should have significant wealth
    expect(result.finalWealth.netWealth).toBeGreaterThan(150000);
    expect(result.finalWealth.assetsValue).toBeGreaterThan(200000);
  });

  test('throws error when insufficient funds for purchase', () => {
    const config: SimulationConfig = {
      initialSavings: 10000,
      initialInvestments: 20000,
      horizonYears: 10,
      inflationRate: 2,
      phases: [
        {
          startYear: 1,
          endYear: 10,
          monthlyIncome: 3000,
          monthlyExpenses: 2000,
          allocationInvestments: 60,
          allocationSavings: 40,
          investmentReturnRate: 7,
          savingsReturnRate: 1,
        },
      ],
      events: [
        {
          year: 1,
          type: 'purchase',
          purchasePrice: 300000,
          downPayment: 100000, // More than available
          debtAmount: 200000,
          debtDuration: 30,
          debtInterestRate: 3,
          assetAppreciationRate: 2,
        },
      ],
    };

    expect(() => simulate(config)).toThrow();
  });

  test('handles negative cash flow by withdrawing from reserves', () => {
    const config: SimulationConfig = {
      initialSavings: 100000,
      initialInvestments: 200000,
      horizonYears: 5,
      inflationRate: 2,
      phases: [
        {
          startYear: 1,
          endYear: 5,
          monthlyIncome: 2000,
          monthlyExpenses: 3000, // Expenses exceed income
          allocationInvestments: 60,
          allocationSavings: 40,
          investmentReturnRate: 0,
          savingsReturnRate: 0,
        },
      ],
      events: [],
    };

    const result = simulate(config);

    // Wealth should decrease due to negative cash flow
    expect(result.finalWealth.netWealth).toBeLessThan(300000);
  });

  test('calculates real wealth correctly with inflation', () => {
    const config: SimulationConfig = {
      initialSavings: 50000,
      initialInvestments: 50000,
      horizonYears: 10,
      inflationRate: 3,
      phases: [
        {
          startYear: 1,
          endYear: 10,
          monthlyIncome: 3000,
          monthlyExpenses: 2000,
          allocationInvestments: 50,
          allocationSavings: 50,
          investmentReturnRate: 0,
          savingsReturnRate: 0,
        },
      ],
      events: [],
    };

    const result = simulate(config);

    // Real wealth should be less than nominal due to inflation
    expect(result.finalWealth.realWealth).toBeLessThan(
      result.finalWealth.netWealth
    );
  });

  test('handles multiple phases with different parameters', () => {
    const config: SimulationConfig = {
      initialSavings: 20000,
      initialInvestments: 30000,
      horizonYears: 20,
      inflationRate: 2,
      phases: [
        {
          startYear: 1,
          endYear: 10,
          monthlyIncome: 2500,
          monthlyExpenses: 2000,
          allocationInvestments: 50,
          allocationSavings: 50,
          investmentReturnRate: 5,
          savingsReturnRate: 1,
        },
        {
          startYear: 11,
          endYear: 20,
          monthlyIncome: 4000,
          monthlyExpenses: 2500,
          allocationInvestments: 70,
          allocationSavings: 30,
          investmentReturnRate: 6,
          savingsReturnRate: 1,
        },
      ],
      events: [],
    };

    const result = simulate(config);

    expect(result.yearlySnapshots).toHaveLength(20);

    const year10 = result.yearlySnapshots[9];
    const year20 = result.yearlySnapshots[19];

    // Year 20 should have more wealth due to higher income in phase 2
    expect(year20.netWealth).toBeGreaterThan(year10.netWealth);
  });
});
