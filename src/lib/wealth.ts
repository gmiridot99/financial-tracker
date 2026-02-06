import { supabase } from './supabase';
import type { WealthSnapshot } from '@/types/database';

/**
 * Calculate wealth (investments and savings) for a specific month.
 *
 * Logic:
 * 1. Check if manual snapshot exists for this month
 * 2. If no snapshot: get previous month's snapshot as base
 * 3. Calculate transactions for current month ("Investimenti" category)
 * 4. Sum: base + transactions = total for month
 *
 * @param userId - The user's ID
 * @param year - The year (e.g., 2026)
 * @param month - The month (1-12)
 * @returns Object with investments and savings balances
 */
export async function calculateWealthForMonth(
  userId: string,
  year: number,
  month: number
): Promise<{ investments: number; savings: number }> {
  try {
    // 1. Check if manual snapshot exists for this month
    const { data: currentSnapshot, error: snapshotError } = await supabase
      .from('wealth_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (snapshotError) {
      console.error('Error fetching wealth snapshot:', snapshotError);
    }

    // If manual snapshot exists, use it as base
    let baseInvestments = 0;
    let baseSavings = 0;

    if (currentSnapshot) {
      baseInvestments = Number(currentSnapshot.investments_balance);
      baseSavings = Number(currentSnapshot.savings_balance);
    } else {
      // 2. No snapshot for this month - get previous month's wealth
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      // Recursively calculate previous month's wealth
      if (prevYear >= 2000) {
        const prevWealth = await calculateWealthForMonth(userId, prevYear, prevMonth);
        baseInvestments = prevWealth.investments;
        baseSavings = prevWealth.savings;
      }
    }

    // 3. Calculate transactions for current month
    // Get start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Query transactions for "Investimenti" category
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('amount, type, categories!inner(name)')
      .eq('user_id', userId)
      .gte('start_date', startDateStr)
      .lte('start_date', endDateStr);

    if (transError) {
      console.error('Error fetching transactions:', transError);
      return { investments: baseInvestments, savings: baseSavings };
    }

    // Calculate monthly investment transactions
    let monthlyInvestments = 0;
    let monthlySavings = 0;

    if (transactions) {
      for (const transaction of transactions) {
        const categoryName = (transaction as any).categories?.name;
        const amount = Number(transaction.amount);
        const type = transaction.type;

        // For investments category
        if (categoryName === 'Investimenti') {
          if (type === 'expense') {
            // Expense means money going into investments (positive contribution)
            monthlyInvestments += amount;
          } else if (type === 'income') {
            // Income from investments (dividends, etc.) - also adds to balance
            monthlyInvestments += amount;
          }
        }

        // For savings category (if it exists in the future)
        if (categoryName === 'Risparmi') {
          if (type === 'expense') {
            monthlySavings += amount;
          } else if (type === 'income') {
            monthlySavings += amount;
          }
        }
      }
    }

    // 4. Sum: base + transactions = total
    const totalInvestments = baseInvestments + monthlyInvestments;
    const totalSavings = baseSavings + monthlySavings;

    return {
      investments: Math.round(totalInvestments * 100) / 100,
      savings: Math.round(totalSavings * 100) / 100,
    };
  } catch (error) {
    console.error('Error calculating wealth:', error);
    return { investments: 0, savings: 0 };
  }
}

/**
 * Get the wealth snapshot for a specific month (if exists).
 * Returns null if no manual snapshot exists.
 */
export async function getWealthSnapshot(
  userId: string,
  year: number,
  month: number
): Promise<WealthSnapshot | null> {
  const { data, error } = await supabase
    .from('wealth_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (error) {
    console.error('Error fetching wealth snapshot:', error);
    return null;
  }

  return data;
}

/**
 * Upsert (create or update) a wealth snapshot for a specific month.
 */
export async function upsertWealthSnapshot(
  userId: string,
  year: number,
  month: number,
  investments: number,
  savings: number
): Promise<boolean> {
  const { error } = await supabase
    .from('wealth_snapshots')
    .upsert(
      {
        user_id: userId,
        year,
        month,
        investments_balance: investments,
        savings_balance: savings,
        is_manual: true,
      },
      {
        onConflict: 'user_id,year,month',
      }
    );

  if (error) {
    console.error('Error upserting wealth snapshot:', error);
    return false;
  }

  return true;
}

/**
 * Calculate wealth for all 12 months of a year in a single batch.
 *
 * Performance optimization for the annual recap page. Instead of calling
 * calculateWealthForMonth() 12 times (each of which recurses backward),
 * this function:
 * 1. Fetches all snapshots for the year in ONE query
 * 2. Finds the most recent snapshot before the year (the "base") in ONE query
 * 3. Fetches all relevant transactions in at most TWO queries
 * 4. Iterates forward month-by-month in memory (no recursion, no extra DB calls)
 *
 * @returns Array of 12 objects (index 0 = January, index 11 = December)
 */
export async function calculateWealthForYear(
  userId: string,
  year: number
): Promise<Array<{ investments: number; savings: number }>> {
  try {
    // 1. Fetch all snapshots for the target year (one query)
    const { data: yearSnapshots, error: yearSnapError } = await supabase
      .from('wealth_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .order('month', { ascending: true });

    if (yearSnapError) {
      console.error('Error fetching year snapshots:', yearSnapError);
    }

    // Index snapshots by month for O(1) lookup
    const snapshotByMonth = new Map<number, { investments_balance: number; savings_balance: number }>();
    if (yearSnapshots) {
      for (const snap of yearSnapshots) {
        snapshotByMonth.set(snap.month, snap);
      }
    }

    // 2. Find the most recent snapshot BEFORE this year to establish baseline.
    //    We look for the latest snapshot with (year < targetYear) OR nothing.
    const { data: prevSnapshot, error: prevSnapError } = await supabase
      .from('wealth_snapshots')
      .select('*')
      .eq('user_id', userId)
      .lt('year', year)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevSnapError) {
      console.error('Error fetching previous snapshot:', prevSnapError);
    }

    // 3. Determine the date range for transactions we need.
    //    We need transactions from (prevSnapshot month+1) through Dec of target year.
    //    If no previous snapshot, we need everything from year 2000-01 onward (but only
    //    investment/savings categories matter, so the query is bounded).
    let transStartDate: string;
    if (prevSnapshot) {
      // Start from the month AFTER the previous snapshot
      const nextMonth = prevSnapshot.month === 12 ? 1 : prevSnapshot.month + 1;
      const nextYear = prevSnapshot.month === 12 ? prevSnapshot.year + 1 : prevSnapshot.year;
      transStartDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    } else {
      transStartDate = '2000-01-01';
    }
    const transEndDate = `${year}-12-31`;

    // 4. Fetch all relevant transactions in ONE query
    const { data: allTransactions, error: transError } = await supabase
      .from('transactions')
      .select('amount, type, start_date, categories!inner(name)')
      .eq('user_id', userId)
      .gte('start_date', transStartDate)
      .lte('start_date', transEndDate);

    if (transError) {
      console.error('Error fetching transactions:', transError);
    }

    // 5. Group transactions by (year, month) for efficient lookup
    const transactionsByYearMonth = new Map<string, Array<{ amount: number; type: string; categoryName: string }>>();
    if (allTransactions) {
      for (const t of allTransactions) {
        const date = new Date(t.start_date);
        const tYear = date.getFullYear();
        const tMonth = date.getMonth() + 1;
        const key = `${tYear}-${tMonth}`;
        if (!transactionsByYearMonth.has(key)) {
          transactionsByYearMonth.set(key, []);
        }
        transactionsByYearMonth.get(key)!.push({
          amount: Number(t.amount),
          type: t.type,
          categoryName: (t as any).categories?.name || '',
        });
      }
    }

    // Helper: compute investment/savings delta for a set of transactions
    const computeMonthDelta = (
      transactions: Array<{ amount: number; type: string; categoryName: string }> | undefined
    ): { investments: number; savings: number } => {
      let investments = 0;
      let savings = 0;
      if (!transactions) return { investments, savings };

      for (const t of transactions) {
        if (t.categoryName === 'Investimenti') {
          investments += t.amount; // Both expense and income add to balance
        }
        if (t.categoryName === 'Risparmi') {
          savings += t.amount;
        }
      }
      return { investments, savings };
    };

    // 6. Establish the base (wealth at the end of the month of the previous snapshot)
    let baseInvestments = 0;
    let baseSavings = 0;
    let baseYear = 2000;
    let baseMonth = 0; // 0 means "before Jan 2000" i.e. start from scratch

    if (prevSnapshot) {
      baseInvestments = Number(prevSnapshot.investments_balance);
      baseSavings = Number(prevSnapshot.savings_balance);
      baseYear = prevSnapshot.year;
      baseMonth = prevSnapshot.month;
    }

    // 7. Walk forward from baseMonth to Dec of the previous year,
    //    applying transactions and respecting any snapshots in the target year.
    //    First, compute carry-forward from base to end of (year-1).
    let currentInvestments = baseInvestments;
    let currentSavings = baseSavings;

    // Walk from (baseYear, baseMonth+1) to (year-1, 12)
    // to accumulate transactions between the base snapshot and the start of our target year
    let walkYear = baseYear;
    let walkMonth = baseMonth + 1;
    if (walkMonth > 12) {
      walkMonth = 1;
      walkYear++;
    }

    while (walkYear < year) {
      const delta = computeMonthDelta(transactionsByYearMonth.get(`${walkYear}-${walkMonth}`));
      currentInvestments += delta.investments;
      currentSavings += delta.savings;

      walkMonth++;
      if (walkMonth > 12) {
        walkMonth = 1;
        walkYear++;
      }
    }

    // 8. Now compute each month of the target year
    const results: Array<{ investments: number; savings: number }> = [];

    for (let month = 1; month <= 12; month++) {
      // Check if there is a manual snapshot for this month
      const snapshot = snapshotByMonth.get(month);

      if (snapshot) {
        // Manual snapshot overrides the running total
        currentInvestments = Number(snapshot.investments_balance);
        currentSavings = Number(snapshot.savings_balance);
      }

      // Add transactions for this month
      const delta = computeMonthDelta(transactionsByYearMonth.get(`${year}-${month}`));
      const monthInvestments = currentInvestments + delta.investments;
      const monthSavings = currentSavings + delta.savings;

      results.push({
        investments: Math.round(monthInvestments * 100) / 100,
        savings: Math.round(monthSavings * 100) / 100,
      });

      // Carry forward for next month
      currentInvestments = monthInvestments;
      currentSavings = monthSavings;
    }

    return results;
  } catch (error) {
    console.error('Error calculating wealth for year:', error);
    return Array.from({ length: 12 }, () => ({ investments: 0, savings: 0 }));
  }
}

/**
 * Calculate wealth for multiple years in a single batch operation.
 *
 * Instead of calling calculateWealthForYear() N times (each making 3 queries),
 * this function uses exactly 3 queries total:
 * 1. Fetch ALL snapshots in [min(years), max(years)] range
 * 2. Fetch the baseline snapshot (latest before min(years))
 * 3. Fetch ALL transactions from baseline through max(years)
 *
 * Then aggregates everything in-memory, carrying forward baselines between years.
 *
 * @param userId - The user's ID
 * @param years - Array of years to compute (e.g., [2024, 2025, 2026])
 * @returns Map where key = year, value = array of 12 monthly wealth objects
 */
export async function calculateWealthForYears(
  userId: string,
  years: number[]
): Promise<Map<number, Array<{ investments: number; savings: number }>>> {
  const result = new Map<number, Array<{ investments: number; savings: number }>>();

  if (years.length === 0) {
    return result;
  }

  const sortedYears = [...years].sort((a, b) => a - b);
  const minYear = sortedYears[0];
  const maxYear = sortedYears[sortedYears.length - 1];

  try {
    // Query 1: Fetch ALL snapshots for the entire range [minYear, maxYear]
    const { data: rangeSnapshots, error: rangeSnapError } = await supabase
      .from('wealth_snapshots')
      .select('*')
      .eq('user_id', userId)
      .gte('year', minYear)
      .lte('year', maxYear)
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (rangeSnapError) {
      console.error('Error fetching range snapshots:', rangeSnapError);
    }

    // Query 2: Fetch baseline snapshot (latest before minYear)
    const { data: baselineSnapshot, error: baselineError } = await supabase
      .from('wealth_snapshots')
      .select('*')
      .eq('user_id', userId)
      .lt('year', minYear)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (baselineError) {
      console.error('Error fetching baseline snapshot:', baselineError);
    }

    // Determine transaction start date
    let transStartDate: string;
    if (baselineSnapshot) {
      const nextMonth = baselineSnapshot.month === 12 ? 1 : baselineSnapshot.month + 1;
      const nextYear = baselineSnapshot.month === 12 ? baselineSnapshot.year + 1 : baselineSnapshot.year;
      transStartDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    } else {
      transStartDate = '2000-01-01';
    }
    const transEndDate = `${maxYear}-12-31`;

    // Query 3: Fetch ALL transactions for the entire range
    const { data: allTransactions, error: transError } = await supabase
      .from('transactions')
      .select('amount, type, start_date, categories!inner(name)')
      .eq('user_id', userId)
      .gte('start_date', transStartDate)
      .lte('start_date', transEndDate);

    if (transError) {
      console.error('Error fetching transactions:', transError);
    }

    // Index snapshots by (year, month) for O(1) lookup
    const snapshotByYearMonth = new Map<string, { investments_balance: number; savings_balance: number }>();
    if (rangeSnapshots) {
      for (const snap of rangeSnapshots) {
        snapshotByYearMonth.set(`${snap.year}-${snap.month}`, snap);
      }
    }

    // Group transactions by (year, month)
    const transactionsByYearMonth = new Map<string, Array<{ amount: number; type: string; categoryName: string }>>();
    if (allTransactions) {
      for (const t of allTransactions) {
        const date = new Date(t.start_date);
        const tYear = date.getFullYear();
        const tMonth = date.getMonth() + 1;
        const key = `${tYear}-${tMonth}`;
        if (!transactionsByYearMonth.has(key)) {
          transactionsByYearMonth.set(key, []);
        }
        transactionsByYearMonth.get(key)!.push({
          amount: Number(t.amount),
          type: t.type,
          categoryName: (t as any).categories?.name || '',
        });
      }
    }

    // Helper: compute investment/savings delta for a month's transactions
    const computeMonthDelta = (
      transactions: Array<{ amount: number; type: string; categoryName: string }> | undefined
    ): { investments: number; savings: number } => {
      let investments = 0;
      let savings = 0;
      if (!transactions) return { investments, savings };
      for (const t of transactions) {
        if (t.categoryName === 'Investimenti') {
          investments += t.amount;
        }
        if (t.categoryName === 'Risparmi') {
          savings += t.amount;
        }
      }
      return { investments, savings };
    };

    // Establish the baseline
    let currentInvestments = 0;
    let currentSavings = 0;
    let baseYear = 2000;
    let baseMonth = 0;

    if (baselineSnapshot) {
      currentInvestments = Number(baselineSnapshot.investments_balance);
      currentSavings = Number(baselineSnapshot.savings_balance);
      baseYear = baselineSnapshot.year;
      baseMonth = baselineSnapshot.month;
    }

    // Walk from baseline to the start of minYear, accumulating transactions
    let walkYear = baseYear;
    let walkMonth = baseMonth + 1;
    if (walkMonth > 12) {
      walkMonth = 1;
      walkYear++;
    }

    while (walkYear < minYear) {
      // Check if there's a snapshot that overrides the running total
      const snapKey = `${walkYear}-${walkMonth}`;
      const snap = snapshotByYearMonth.get(snapKey);
      if (snap) {
        currentInvestments = Number(snap.investments_balance);
        currentSavings = Number(snap.savings_balance);
      }

      const delta = computeMonthDelta(transactionsByYearMonth.get(snapKey));
      currentInvestments += delta.investments;
      currentSavings += delta.savings;

      walkMonth++;
      if (walkMonth > 12) {
        walkMonth = 1;
        walkYear++;
      }
    }

    // Now process each year from minYear to maxYear sequentially.
    // Even if a year is not in the requested set, we still need to walk through
    // it to maintain correct carry-forward.
    const requestedYearsSet = new Set(years);

    for (let y = minYear; y <= maxYear; y++) {
      const yearResults: Array<{ investments: number; savings: number }> = [];

      for (let m = 1; m <= 12; m++) {
        const snapKey = `${y}-${m}`;
        const snapshot = snapshotByYearMonth.get(snapKey);

        if (snapshot) {
          currentInvestments = Number(snapshot.investments_balance);
          currentSavings = Number(snapshot.savings_balance);
        }

        const delta = computeMonthDelta(transactionsByYearMonth.get(snapKey));
        const monthInvestments = currentInvestments + delta.investments;
        const monthSavings = currentSavings + delta.savings;

        yearResults.push({
          investments: Math.round(monthInvestments * 100) / 100,
          savings: Math.round(monthSavings * 100) / 100,
        });

        currentInvestments = monthInvestments;
        currentSavings = monthSavings;
      }

      if (requestedYearsSet.has(y)) {
        result.set(y, yearResults);
      }
    }

    return result;
  } catch (error) {
    console.error('Error calculating wealth for years:', error);
    // Return empty results for all requested years
    for (const y of years) {
      result.set(y, Array.from({ length: 12 }, () => ({ investments: 0, savings: 0 })));
    }
    return result;
  }
}

/**
 * Get all wealth snapshots for a year.
 */
export async function getYearWealthSnapshots(
  userId: string,
  year: number
): Promise<WealthSnapshot[]> {
  const { data, error } = await supabase
    .from('wealth_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .order('month', { ascending: true });

  if (error) {
    console.error('Error fetching year wealth snapshots:', error);
    return [];
  }

  return data || [];
}
