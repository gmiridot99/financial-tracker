import { describe, it, expect } from 'vitest';
import {
  calculateNetIncome,
  calculateSavingsAndInvestments,
  calculateMonthlySummary,
} from './calculations';

describe('calculateNetIncome', () => {
  it('should calculate net income correctly with income and expenses', () => {
    const transactions = [
      { type: 'income' as const, amount: 3000 },
      { type: 'income' as const, amount: 500 },
      { type: 'expense' as const, amount: 1200 },
      { type: 'expense' as const, amount: 300 },
    ];

    const result = calculateNetIncome(transactions);
    expect(result).toBe(2000); // 3500 - 1500 = 2000
  });

  it('should return positive value with only income', () => {
    const transactions = [
      { type: 'income' as const, amount: 3000 },
      { type: 'income' as const, amount: 500 },
    ];

    const result = calculateNetIncome(transactions);
    expect(result).toBe(3500);
  });

  it('should return negative value with only expenses', () => {
    const transactions = [
      { type: 'expense' as const, amount: 1200 },
      { type: 'expense' as const, amount: 300 },
    ];

    const result = calculateNetIncome(transactions);
    expect(result).toBe(-1500);
  });

  it('should return 0 with no transactions', () => {
    const result = calculateNetIncome([]);
    expect(result).toBe(0);
  });

  it('should return 0 when income equals expenses', () => {
    const transactions = [
      { type: 'income' as const, amount: 1500 },
      { type: 'expense' as const, amount: 1500 },
    ];

    const result = calculateNetIncome(transactions);
    expect(result).toBe(0);
  });
});

describe('calculateSavingsAndInvestments', () => {
  it('should calculate savings and investments with default settings (40/60)', () => {
    const netIncome = 2000;
    const settings = {
      savings_percentage: 40,
      investments_percentage: 60,
    };

    const result = calculateSavingsAndInvestments(netIncome, settings);
    expect(result.savings).toBe(800); // 2000 * 0.4
    expect(result.investments).toBe(1200); // 2000 * 0.6
  });

  it('should calculate with custom percentages', () => {
    const netIncome = 1000;
    const settings = {
      savings_percentage: 30,
      investments_percentage: 70,
    };

    const result = calculateSavingsAndInvestments(netIncome, settings);
    expect(result.savings).toBe(300);
    expect(result.investments).toBe(700);
  });

  it('should return 0 for both when net income is 0', () => {
    const settings = {
      savings_percentage: 40,
      investments_percentage: 60,
    };

    const result = calculateSavingsAndInvestments(0, settings);
    expect(result.savings).toBe(0);
    expect(result.investments).toBe(0);
  });

  it('should return 0 for both when net income is negative', () => {
    const settings = {
      savings_percentage: 40,
      investments_percentage: 60,
    };

    const result = calculateSavingsAndInvestments(-500, settings);
    expect(result.savings).toBe(0);
    expect(result.investments).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    const netIncome = 1000;
    const settings = {
      savings_percentage: 33.33,
      investments_percentage: 66.67,
    };

    const result = calculateSavingsAndInvestments(netIncome, settings);
    expect(result.savings).toBe(333.3);
    expect(result.investments).toBe(666.7);
  });
});

describe('calculateMonthlySummary', () => {
  it('should calculate complete summary correctly', () => {
    const transactions = [
      { type: 'income' as const, amount: 3000 },
      { type: 'income' as const, amount: 500 },
      { type: 'expense' as const, amount: 1200 },
      { type: 'expense' as const, amount: 300 },
    ];
    const settings = {
      savings_percentage: 40,
      investments_percentage: 60,
    };

    const result = calculateMonthlySummary(transactions, settings);

    expect(result.totalIncome).toBe(3500);
    expect(result.totalExpenses).toBe(1500);
    expect(result.net).toBe(2000);
    expect(result.savings).toBe(800);
    expect(result.investments).toBe(1200);
  });

  it('should handle negative net income correctly', () => {
    const transactions = [
      { type: 'income' as const, amount: 1000 },
      { type: 'expense' as const, amount: 1500 },
    ];
    const settings = {
      savings_percentage: 40,
      investments_percentage: 60,
    };

    const result = calculateMonthlySummary(transactions, settings);

    expect(result.totalIncome).toBe(1000);
    expect(result.totalExpenses).toBe(1500);
    expect(result.net).toBe(-500);
    expect(result.savings).toBe(0);
    expect(result.investments).toBe(0);
  });

  it('should handle empty transactions', () => {
    const settings = {
      savings_percentage: 40,
      investments_percentage: 60,
    };

    const result = calculateMonthlySummary([], settings);

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.net).toBe(0);
    expect(result.savings).toBe(0);
    expect(result.investments).toBe(0);
  });

  it('should work with only income transactions', () => {
    const transactions = [
      { type: 'income' as const, amount: 5000 },
    ];
    const settings = {
      savings_percentage: 50,
      investments_percentage: 50,
    };

    const result = calculateMonthlySummary(transactions, settings);

    expect(result.totalIncome).toBe(5000);
    expect(result.totalExpenses).toBe(0);
    expect(result.net).toBe(5000);
    expect(result.savings).toBe(2500);
    expect(result.investments).toBe(2500);
  });
});
