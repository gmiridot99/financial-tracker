import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateWealthForMonth, calculateWealthForYears } from './wealth';
import { supabase } from './supabase';

// Mock Supabase client
vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// --- Helper to build chained Supabase mock ---
// Both calculateWealthForMonth (via delegation) and calculateWealthForYears
// make exactly 4 calls to supabase.from():
//   1. 'wealth_snapshots' -> .select().eq().gte().lte().order().order() -> { data, error }
//   2. 'wealth_snapshots' -> .select().eq().lt().order().order().limit().maybeSingle() -> { data, error }
//   3. 'transactions'     -> .select().eq().gte().lte() -> { data, error }
//   4. 'transfers'        -> .select().eq().gte().lte() -> { data, error }

function buildYearsMock(
  rangeSnapshots: any[] | null,
  baselineSnapshot: any | null,
  transactions: any[] | null,
  transfers: any[] | null = []
) {
  // Query 1: range snapshots - select().eq().gte().lte().order().order()
  const query1 = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: rangeSnapshots,
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  };

  // Query 2: baseline snapshot - select().eq().lt().order().order().limit().maybeSingle()
  const query2 = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: baselineSnapshot,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };

  // Query 3: transactions - select().eq().gte().lte().or()
  const query3 = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: transactions,
              error: null,
            }),
          }),
        }),
      }),
    }),
  };

  // Query 4: transfers - select().eq().gte().lte().or()
  const query4 = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: transfers,
              error: null,
            }),
          }),
        }),
      }),
    }),
  };

  return vi.fn()
    .mockReturnValueOnce(query1)
    .mockReturnValueOnce(query2)
    .mockReturnValueOnce(query3)
    .mockReturnValueOnce(query4);
}

// =============================================================================
// calculateWealthForMonth
// Ora delega a calculateWealthForYears → stessa struttura mock (3 query)
// =============================================================================

describe('calculateWealthForMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return manual snapshot values when snapshot exists', async () => {
    (supabase.from as any) = buildYearsMock(
      [{ year: 2026, month: 1, investments_balance: 10000, savings_balance: 5000 }],
      null,
      []
    );

    const result = await calculateWealthForMonth('user-123', 2026, 1);

    expect(result.investments).toBe(10000);
    expect(result.savings).toBe(5000);
  });

  it('should return zeros when no snapshot and no previous month', async () => {
    (supabase.from as any) = buildYearsMock([], null, []);

    const result = await calculateWealthForMonth('user-123', 2000, 1);

    expect(result.investments).toBe(0);
    expect(result.savings).toBe(0);
  });

  it('should add investment expense transactions to base amount', async () => {
    (supabase.from as any) = buildYearsMock(
      [{ year: 2026, month: 1, investments_balance: 10000, savings_balance: 5000 }],
      null,
      [{ amount: 500, type: 'expense', start_date: '2026-01-15', categories: { name: 'Investimenti' } }]
    );

    const result = await calculateWealthForMonth('user-123', 2026, 1);

    expect(result.investments).toBe(10500); // 10000 + 500
    expect(result.savings).toBe(5000);
  });

  it('should subtract investment income (vendita/prelievo) from balance', async () => {
    // Income da Investimenti = prelievo/vendita → sottrae dal bilancio
    (supabase.from as any) = buildYearsMock(
      [{ year: 2026, month: 1, investments_balance: 10000, savings_balance: 5000 }],
      null,
      [{ amount: 200, type: 'income', start_date: '2026-01-15', categories: { name: 'Investimenti' } }]
    );

    const result = await calculateWealthForMonth('user-123', 2026, 1);

    expect(result.investments).toBe(9800); // 10000 - 200 (income sottrae)
    expect(result.savings).toBe(5000);
  });

  it('should handle multiple investment transactions with mixed types', async () => {
    (supabase.from as any) = buildYearsMock(
      [{ year: 2026, month: 1, investments_balance: 10000, savings_balance: 5000 }],
      null,
      [
        { amount: 500, type: 'expense', start_date: '2026-01-15', categories: { name: 'Investimenti' } },
        { amount: 300, type: 'expense', start_date: '2026-01-15', categories: { name: 'Investimenti' } },
        { amount: 100, type: 'income', start_date: '2026-01-15', categories: { name: 'Investimenti' } },
      ]
    );

    const result = await calculateWealthForMonth('user-123', 2026, 1);

    expect(result.investments).toBe(10700); // 10000 + 500 + 300 - 100
    expect(result.savings).toBe(5000);
  });

  it('should round to 2 decimal places', async () => {
    (supabase.from as any) = buildYearsMock(
      [{ year: 2026, month: 1, investments_balance: 10000.456, savings_balance: 5000.789 }],
      null,
      [{ amount: 100.123, type: 'expense', start_date: '2026-01-15', categories: { name: 'Investimenti' } }]
    );

    const result = await calculateWealthForMonth('user-123', 2026, 1);

    expect(result.investments).toBe(10100.58); // 10000.456 + 100.123 = 10100.579 → 10100.58
    expect(result.savings).toBe(5000.79); // 5000.789 → 5000.79
  });

  it('should return zeros on error', async () => {
    // Qualsiasi errore nel batch fa scattare il catch → tutti zeri
    (supabase.from as any) = vi.fn().mockImplementation(() => {
      throw new Error('Database error');
    });

    const result = await calculateWealthForMonth('user-123', 2026, 1);

    expect(result.investments).toBe(0);
    expect(result.savings).toBe(0);
  });

  it('should ignore non-investment transactions', async () => {
    (supabase.from as any) = buildYearsMock(
      [{ year: 2026, month: 1, investments_balance: 10000, savings_balance: 5000 }],
      null,
      [
        { amount: 500, type: 'expense', start_date: '2026-01-15', categories: { name: 'Cibo' } },
        { amount: 300, type: 'expense', start_date: '2026-01-15', categories: { name: 'Trasporti' } },
      ]
    );

    const result = await calculateWealthForMonth('user-123', 2026, 1);

    expect(result.investments).toBe(10000);
    expect(result.savings).toBe(5000);
  });
});

// =============================================================================
// calculateWealthForYears
// =============================================================================

describe('calculateWealthForYears', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle 3 consecutive years (2024-2026) with baseline carry-forward', async () => {
    // Baseline: end of Dec 2023 = investments 10000, savings 5000
    // Transactions: Jan 2024 +500 inv, Jan 2025 +300 inv, Jan 2026 +200 inv
    const rangeSnapshots: any[] = [];
    const baselineSnapshot = {
      year: 2023,
      month: 12,
      investments_balance: 10000,
      savings_balance: 5000,
    };
    const transactions = [
      { amount: 500, type: 'expense', start_date: '2024-01-15', categories: { name: 'Investimenti' } },
      { amount: 300, type: 'expense', start_date: '2025-01-15', categories: { name: 'Investimenti' } },
      { amount: 200, type: 'expense', start_date: '2026-01-15', categories: { name: 'Investimenti' } },
    ];

    (supabase.from as any) = buildYearsMock(rangeSnapshots, baselineSnapshot, transactions);

    const result = await calculateWealthForYears('user-123', [2024, 2025, 2026]);

    expect(result.size).toBe(3);

    // 2024: baseline 10000, Jan +500 = 10500, rest carry forward
    const y2024 = result.get(2024)!;
    expect(y2024).toHaveLength(12);
    expect(y2024[0].investments).toBe(10500); // Jan: 10000 + 500
    expect(y2024[11].investments).toBe(10500); // Dec: carried forward

    // 2025: baseline from end of 2024 = 10500, Jan +300 = 10800
    const y2025 = result.get(2025)!;
    expect(y2025[0].investments).toBe(10800); // Jan: 10500 + 300
    expect(y2025[11].investments).toBe(10800); // Dec

    // 2026: baseline from end of 2025 = 10800, Jan +200 = 11000
    const y2026 = result.get(2026)!;
    expect(y2026[0].investments).toBe(11000); // Jan: 10800 + 200
    expect(y2026[11].investments).toBe(11000); // Dec

    // Savings should carry forward unchanged
    expect(y2024[0].savings).toBe(5000);
    expect(y2025[0].savings).toBe(5000);
    expect(y2026[0].savings).toBe(5000);
  });

  it('should handle gap between years (2024, 2026 - no 2025 requested)', async () => {
    // Even though 2025 is not requested, its data should still be walked
    // to produce correct carry-forward for 2026
    const rangeSnapshots: any[] = [];
    const baselineSnapshot = {
      year: 2023,
      month: 12,
      investments_balance: 10000,
      savings_balance: 5000,
    };
    const transactions = [
      { amount: 500, type: 'expense', start_date: '2024-06-15', categories: { name: 'Investimenti' } },
      { amount: 1000, type: 'expense', start_date: '2025-06-15', categories: { name: 'Investimenti' } },
      { amount: 200, type: 'expense', start_date: '2026-01-15', categories: { name: 'Investimenti' } },
    ];

    (supabase.from as any) = buildYearsMock(rangeSnapshots, baselineSnapshot, transactions);

    const result = await calculateWealthForYears('user-123', [2024, 2026]);

    expect(result.size).toBe(2);
    expect(result.has(2025)).toBe(false); // Not requested

    // 2024: baseline 10000, Jun +500 = 10500
    const y2024 = result.get(2024)!;
    expect(y2024[5].investments).toBe(10500); // Jun (index 5)
    expect(y2024[11].investments).toBe(10500); // Dec carry

    // 2026: baseline should include 2025 transactions even though 2025 not requested
    // End of 2025 = 10500 + 1000 = 11500, then Jan 2026 +200 = 11700
    const y2026 = result.get(2026)!;
    expect(y2026[0].investments).toBe(11700); // Jan: 11500 + 200
  });

  it('should carry forward baseline between years correctly with snapshots', async () => {
    // Snapshot in March 2025 overrides the running total
    const rangeSnapshots = [
      { year: 2025, month: 3, investments_balance: 20000, savings_balance: 8000 },
    ];
    const baselineSnapshot = {
      year: 2023,
      month: 12,
      investments_balance: 10000,
      savings_balance: 5000,
    };
    const transactions = [
      { amount: 500, type: 'expense', start_date: '2024-01-15', categories: { name: 'Investimenti' } },
      { amount: 100, type: 'expense', start_date: '2025-04-10', categories: { name: 'Investimenti' } },
    ];

    (supabase.from as any) = buildYearsMock(rangeSnapshots, baselineSnapshot, transactions);

    const result = await calculateWealthForYears('user-123', [2024, 2025]);

    // 2024: baseline 10000, Jan +500 = 10500
    const y2024 = result.get(2024)!;
    expect(y2024[0].investments).toBe(10500);
    expect(y2024[11].investments).toBe(10500);

    // 2025: Jan-Feb carry from 2024 end (10500), Mar snapshot resets to 20000,
    // Apr = 20000 + 100 = 20100
    const y2025 = result.get(2025)!;
    expect(y2025[0].investments).toBe(10500); // Jan: carried from 2024
    expect(y2025[1].investments).toBe(10500); // Feb: carried
    expect(y2025[2].investments).toBe(20000); // Mar: snapshot override, no transactions
    expect(y2025[3].investments).toBe(20100); // Apr: 20000 + 100
    expect(y2025[3].savings).toBe(8000); // Savings from snapshot

    expect(y2025[11].investments).toBe(20100); // Dec carry
  });

  it('should complete in under 5 seconds for 10 years of data', async () => {
    // Generate 10 years of transaction data (120 months)
    const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const transactions: any[] = [];

    for (const y of years) {
      for (let m = 1; m <= 12; m++) {
        transactions.push({
          amount: 100,
          type: 'expense',
          start_date: `${y}-${String(m).padStart(2, '0')}-15`,
          categories: { name: 'Investimenti' },
        });
        transactions.push({
          amount: 50,
          type: 'expense',
          start_date: `${y}-${String(m).padStart(2, '0')}-20`,
          categories: { name: 'Risparmi' },
        });
      }
    }

    const baselineSnapshot = {
      year: 2016,
      month: 12,
      investments_balance: 50000,
      savings_balance: 20000,
    };

    (supabase.from as any) = buildYearsMock([], baselineSnapshot, transactions);

    const start = performance.now();
    const result = await calculateWealthForYears('user-123', years);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5000); // Must complete in under 5 seconds
    expect(result.size).toBe(10);

    // Verify correctness: each month adds 100 inv + 50 sav
    // After 120 months (10 years): 50000 + (120 * 100) = 62000 investments
    const lastYear = result.get(2026)!;
    expect(lastYear[11].investments).toBe(50000 + 120 * 100); // 62000
    expect(lastYear[11].savings).toBe(20000 + 120 * 50); // 26000
  });

  it('should return empty map for empty years array', async () => {
    const result = await calculateWealthForYears('user-123', []);
    expect(result.size).toBe(0);
  });

  it('should handle no baseline and no snapshots', async () => {
    const transactions = [
      { amount: 1000, type: 'expense', start_date: '2024-03-15', categories: { name: 'Investimenti' } },
    ];

    (supabase.from as any) = buildYearsMock([], null, transactions);

    const result = await calculateWealthForYears('user-123', [2024]);

    const y2024 = result.get(2024)!;
    expect(y2024[0].investments).toBe(0); // Jan: no baseline, no transactions
    expect(y2024[2].investments).toBe(1000); // Mar: 0 + 1000
    expect(y2024[11].investments).toBe(1000); // Dec carry
  });

  it('should use exactly 4 supabase.from() calls', async () => {
    const mockFrom = buildYearsMock([], null, []);
    (supabase.from as any) = mockFrom;

    await calculateWealthForYears('user-123', [2024, 2025, 2026]);

    // Exactly 4 calls regardless of number of years
    // (snapshots range, baseline snapshot, transactions, transfers)
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });
});

// =============================================================================
// FIX VERIFICATI
// Questi test verificano che i bug risolti nel refactoring funzionino.
// Prima del fix: FALLIVANO. Ora: PASSANO.
// =============================================================================

describe('[FIX] Income sottrae correttamente dal bilancio (non somma)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('income da "Investimenti" (vendita/prelievo) dovrebbe SOTTRARRE dal bilancio', async () => {
    // Scenario: l'utente ha 10000 in investimenti e vende titoli per 2000.
    // La vendita genera un "income" con categoria "Investimenti".
    // Il bilancio investimenti deve DIMINUIRE: 10000 - 2000 = 8000.
    (supabase.from as any) = buildYearsMock(
      [{ year: 2026, month: 3, investments_balance: 10000, savings_balance: 5000 }],
      null,
      [{ amount: 2000, type: 'income', start_date: '2026-03-15', categories: { name: 'Investimenti' } }]
    );

    const result = await calculateWealthForMonth('user-123', 2026, 3);

    // Prima del fix: 10000 + 2000 = 12000 (SBAGLIATO)
    // Dopo il fix:   10000 - 2000 = 8000 (CORRETTO)
    expect(result.investments).toBe(8000);
  });

  it('income da "Risparmi" (prelievo) dovrebbe SOTTRARRE dal bilancio', async () => {
    // Scenario: l'utente ha 8000 in risparmi e preleva 1500.
    // Il prelievo genera un "income" con categoria "Risparmi".
    // Il bilancio risparmi deve DIMINUIRE: 8000 - 1500 = 6500.
    (supabase.from as any) = buildYearsMock(
      [{ year: 2026, month: 3, investments_balance: 5000, savings_balance: 8000 }],
      null,
      [{ amount: 1500, type: 'income', start_date: '2026-03-15', categories: { name: 'Risparmi' } }]
    );

    const result = await calculateWealthForMonth('user-123', 2026, 3);

    // Prima del fix: 8000 + 1500 = 9500 (SBAGLIATO)
    // Dopo il fix:   8000 - 1500 = 6500 (CORRETTO)
    expect(result.savings).toBe(6500);
  });
});

describe('[FIX] Nessuna ricorsione - max 4 query DB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dovrebbe fare esattamente 4 query DB anche senza snapshot precedenti', async () => {
    // Scenario: nessuno snapshot esiste nel DB.
    // Prima del fix: ~636 query DB (ricorsione fino al 2000)
    // Dopo il fix: esattamente 4 query DB (batch: range snap, baseline, transactions, transfers)
    const mockFrom = buildYearsMock([], null, []);
    (supabase.from as any) = mockFrom;

    const result = await calculateWealthForMonth('user-123', 2026, 6);

    // Prima del fix: 636 chiamate DB
    // Dopo il fix: esattamente 4
    expect(mockFrom).toHaveBeenCalledTimes(4);

    expect(result).toEqual({ investments: 0, savings: 0 });
  });
});
