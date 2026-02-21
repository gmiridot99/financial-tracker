import { supabase } from './supabase';
import type { WealthSnapshot, Transfer } from '@/types/database';
import { computeHoldings } from '@/lib/portfolio';
import type { PortfolioTransaction } from '@/lib/portfolio';

// --- Types ---

/** Tipo per il risultato della query Supabase con join su categories */
type TransactionWithCategory = {
  amount: number;
  type: string;
  start_date: string;
  categories: { name: string } | null;
};

/** Transazione normalizzata per il calcolo del delta mensile */
type NormalizedTransaction = {
  amount: number;
  type: string;
  categoryName: string;
};

// --- Funzioni di calcolo pure ---

/**
 * Calcola il delta mensile di investimenti e risparmi da transazioni e trasferimenti.
 *
 * Transazioni legacy (categorie):
 *   expense → aggiunge al pool (soldi che entrano nel pool)
 *   income → sottrae dal pool (soldi che escono/prelievi)
 *
 * Trasferimenti (nuovo sistema):
 *   savings → investment: savings -= amount, investments += amount
 *   savings → savings: nessun effetto sul totale wealth (pool invariato)
 */
function computeMonthDelta(
  transactions: NormalizedTransaction[] | undefined,
  transfers: Pick<Transfer, 'amount' | 'to_savings_account_id' | 'to_investment_account_id'>[] = []
): { investments: number; savings: number } {
  let investments = 0;
  let savings = 0;

  if (transactions) {
    for (const t of transactions) {
      const sign = t.type === 'expense' ? 1 : -1;
      if (t.categoryName === 'Investimenti') {
        investments += sign * t.amount;
      }
      if (t.categoryName === 'Risparmi') {
        savings += sign * t.amount;
      }
    }
  }

  for (const tr of transfers) {
    const amount = Number(tr.amount);
    if (tr.to_investment_account_id) {
      // savings → investment: money leaves savings pool, enters investment pool
      savings -= amount;
      investments += amount;
    }
    // savings → savings: no net wealth change
  }

  return { investments, savings };
}

// --- Funzioni pubbliche ---

/**
 * Calcola il patrimonio (investimenti e risparmi) per un mese specifico.
 *
 * Delega a calculateWealthForYears per evitare ricorsione e massimizzare
 * l'efficienza delle query DB (max 3 query).
 *
 * @param userId - ID utente
 * @param year - Anno (es. 2026)
 * @param month - Mese (1-12)
 * @returns Oggetto con bilanci investimenti e risparmi
 */
export async function calculateWealthForMonth(
  userId: string,
  year: number,
  month: number
): Promise<{ investments: number; savings: number }> {
  const result = await calculateWealthForYears(userId, [year]);
  const yearData = result.get(year);
  if (!yearData || month < 1 || month > 12) {
    return { investments: 0, savings: 0 };
  }
  return yearData[month - 1];
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
 * Calcola il patrimonio per tutti i 12 mesi di un anno.
 * Wrapper su calculateWealthForYears per singolo anno.
 *
 * @returns Array di 12 oggetti (indice 0 = Gennaio, indice 11 = Dicembre)
 */
export async function calculateWealthForYear(
  userId: string,
  year: number
): Promise<Array<{ investments: number; savings: number }>> {
  const result = await calculateWealthForYears(userId, [year]);
  return result.get(year) || Array.from({ length: 12 }, () => ({ investments: 0, savings: 0 }));
}

/**
 * Calcola il patrimonio per piu anni in un'unica operazione batch.
 *
 * Usa esattamente 3 query DB, indipendentemente dal numero di anni:
 * 1. Fetch di TUTTI gli snapshot nell'intervallo [min(years), max(years)]
 * 2. Fetch dello snapshot baseline (il piu recente prima di min(years))
 * 3. Fetch di TUTTE le transazioni dal baseline a max(years)
 *
 * Poi aggrega tutto in memoria, portando avanti i bilanci tra gli anni.
 *
 * @param userId - ID utente
 * @param years - Array di anni da calcolare (es. [2024, 2025, 2026])
 * @returns Map dove key = anno, value = array di 12 oggetti mensili
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
    const { data: rawTransactions, error: transError } = await supabase
      .from('transactions')
      .select('amount, type, start_date, categories!inner(name)')
      .eq('user_id', userId)
      .gte('start_date', transStartDate)
      .lte('start_date', transEndDate);

    if (transError) {
      console.error('Error fetching transactions:', transError);
    }

    // Query 4: Fetch ALL transfers for the entire range
    const { data: rawTransfers, error: transferError } = await supabase
      .from('transfers')
      .select('amount, date, to_savings_account_id, to_investment_account_id')
      .eq('user_id', userId)
      .gte('date', transStartDate)
      .lte('date', transEndDate);

    if (transferError) {
      console.error('Error fetching transfers:', transferError);
    }

    // Index snapshots by (year, month) for O(1) lookup
    const snapshotByYearMonth = new Map<string, { investments_balance: number; savings_balance: number }>();
    if (rangeSnapshots) {
      for (const snap of rangeSnapshots) {
        snapshotByYearMonth.set(`${snap.year}-${snap.month}`, snap);
      }
    }

    // Group transactions by (year, month)
    // Supabase tipizza categories!inner come array, ma la relazione many-to-one
    // restituisce un singolo oggetto a runtime. Usiamo unknown come ponte sicuro.
    const allTransactions = (rawTransactions ?? []) as unknown as TransactionWithCategory[];
    const transactionsByYearMonth = new Map<string, NormalizedTransaction[]>();
    for (const t of allTransactions) {
      const date = new Date(t.start_date);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!transactionsByYearMonth.has(key)) {
        transactionsByYearMonth.set(key, []);
      }
      transactionsByYearMonth.get(key)!.push({
        amount: Number(t.amount),
        type: t.type,
        categoryName: t.categories?.name || '',
      });
    }

    // Group transfers by (year, month)
    type TransferForDelta = Pick<Transfer, 'amount' | 'to_savings_account_id' | 'to_investment_account_id'>;
    const transfersByYearMonth = new Map<string, TransferForDelta[]>();
    for (const tr of (rawTransfers ?? [])) {
      const date = new Date(tr.date);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!transfersByYearMonth.has(key)) {
        transfersByYearMonth.set(key, []);
      }
      transfersByYearMonth.get(key)!.push({
        amount: Number(tr.amount),
        to_savings_account_id: tr.to_savings_account_id,
        to_investment_account_id: tr.to_investment_account_id,
      });
    }

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
      const snapKey = `${walkYear}-${walkMonth}`;
      const snap = snapshotByYearMonth.get(snapKey);
      if (snap) {
        currentInvestments = Number(snap.investments_balance);
        currentSavings = Number(snap.savings_balance);
      }

      const delta = computeMonthDelta(transactionsByYearMonth.get(snapKey), transfersByYearMonth.get(snapKey));
      currentInvestments += delta.investments;
      currentSavings += delta.savings;

      walkMonth++;
      if (walkMonth > 12) {
        walkMonth = 1;
        walkYear++;
      }
    }

    // Process each year from minYear to maxYear sequentially
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

        const delta = computeMonthDelta(transactionsByYearMonth.get(snapKey), transfersByYearMonth.get(snapKey));
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

/**
 * Calculates and upserts a wealth snapshot using real account data.
 *
 * investments_balance = sum(market_value of all holdings)
 *                     + sum(cash_balance of all investment accounts)
 *
 * savings_balance = sum(balance of all savings accounts)
 *
 * If market prices are unavailable for a holding, falls back to cost basis.
 * Upserts into wealth_snapshots for the current year/month with is_manual: false.
 */
export async function updateWealthSnapshotFromAccounts(userId: string): Promise<void> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 1. Fetch savings accounts balances
    const { data: savingsAccounts, error: savingsError } = await supabase
      .from('savings_accounts')
      .select('balance')
      .eq('user_id', userId);

    if (savingsError) {
      console.error('Error fetching savings accounts for snapshot:', savingsError);
    }

    const totalSavingsAccounts = (savingsAccounts ?? []).reduce(
      (sum, a) => sum + Number(a.balance),
      0
    );

    // 2. Fetch investment accounts (cash_balance)
    const { data: investmentAccounts, error: investError } = await supabase
      .from('investment_accounts')
      .select('cash_balance')
      .eq('user_id', userId);

    if (investError) {
      console.error('Error fetching investment accounts for snapshot:', investError);
    }

    const totalCashBalance = (investmentAccounts ?? []).reduce(
      (sum, a) => sum + Number(a.cash_balance),
      0
    );

    // 4. Fetch all investment transactions
    const { data: investmentTxns, error: txnError } = await supabase
      .from('investment_transactions')
      .select('asset_symbol, asset_name, asset_type, transaction_type, quantity, price_per_unit, total_amount')
      .eq('user_id', userId);

    if (txnError) {
      console.error('Error fetching investment transactions for snapshot:', txnError);
    }

    // 5. Compute holdings from transactions
    const portfolioTransactions: PortfolioTransaction[] = (investmentTxns ?? []).map(t => ({
      asset_symbol: t.asset_symbol,
      asset_name: t.asset_name,
      asset_type: t.asset_type,
      transaction_type: t.transaction_type as 'buy' | 'sell',
      quantity: Number(t.quantity),
      price_per_unit: Number(t.price_per_unit),
      total_amount: Number(t.total_amount),
    }));

    const holdings = computeHoldings(portfolioTransactions);

    // 6. Look up current prices from asset_prices_cache
    let totalHoldingsValue = 0;

    if (holdings.length > 0) {
      const symbols = holdings.map(h => h.symbol);

      const { data: priceData, error: priceError } = await supabase
        .from('asset_prices_cache')
        .select('symbol, current_price')
        .in('symbol', symbols);

      if (priceError) {
        console.error('Error fetching asset prices for snapshot:', priceError);
      }

      // Build symbol -> price map
      const priceMap = new Map<string, number>();
      if (priceData) {
        for (const p of priceData) {
          if (p.current_price != null) {
            priceMap.set(p.symbol, Number(p.current_price));
          }
        }
      }

      // 7. Calculate market value for each holding, fallback to costBasis
      for (const holding of holdings) {
        const price = priceMap.get(holding.symbol);
        if (price != null) {
          totalHoldingsValue += holding.quantity * price;
        } else {
          // Fallback to cost basis when market price unavailable
          totalHoldingsValue += holding.costBasis;
        }
      }
    }

    // 8. Sum everything up
    const savingsBalance = Math.round(totalSavingsAccounts * 100) / 100;

    const investmentsBalance = Math.round(
      (totalHoldingsValue + totalCashBalance) * 100
    ) / 100;

    // 9. Upsert into wealth_snapshots
    const { error: upsertError } = await supabase
      .from('wealth_snapshots')
      .upsert(
        {
          user_id: userId,
          year,
          month,
          investments_balance: investmentsBalance,
          savings_balance: savingsBalance,
          is_manual: false,
        },
        {
          onConflict: 'user_id,year,month',
        }
      );

    if (upsertError) {
      console.error('Error upserting wealth snapshot from accounts:', upsertError);
    }
  } catch (error) {
    console.error('Error updating wealth snapshot from accounts:', error);
  }
}
