'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, TrendingUp, Wallet, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateWealthForYear } from '@/lib/wealth';
import AnnualTrendChart, { MonthlyData } from '@/components/AnnualTrendChart';
import AnnualInsights, { AnnualInsightsData } from '@/components/AnnualInsights';
import CategoryBreakdownChart, { CategoryData } from '@/components/CategoryBreakdownChart';
import YearComparisonCards, { YearComparison, MultiYearInsights } from '@/components/YearComparisonCards';
import toast from 'react-hot-toast';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  category_name?: string;
  start_date: string;
}

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MONTH_LABELS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** Number of surrounding years to fetch for multi-year comparison (e.g. 2 = current year +/- 2). */
const COMPARISON_RANGE = 2;

// ---------------------------------------------------------------------------
// Helper: calculate year-over-year comparison data
// ---------------------------------------------------------------------------

interface YearlySummary {
  year: number;
  income: number;
  expenses: number;
  net: number;
}

function buildYearComparisons(summaries: YearlySummary[]): YearComparison[] {
  return summaries.map((s, i) => {
    const prev = i > 0 ? summaries[i - 1] : null;

    const growthPercent = prev && prev.net !== 0
      ? ((s.net - prev.net) / Math.abs(prev.net)) * 100
      : 0;

    const incomeGrowthPercent = prev && prev.income !== 0
      ? ((s.income - prev.income) / prev.income) * 100
      : 0;

    const expenseGrowthPercent = prev && prev.expenses !== 0
      ? ((s.expenses - prev.expenses) / prev.expenses) * 100
      : 0;

    return {
      year: s.year,
      income: s.income,
      expenses: s.expenses,
      net: s.net,
      growthPercent,
      incomeGrowthPercent,
      expenseGrowthPercent,
    };
  });
}

function calculateMultiYearInsights(comparisons: YearComparison[]): MultiYearInsights {
  let bestIdx = 0;
  let worstIdx = 0;

  comparisons.forEach((c, i) => {
    if (c.net > comparisons[bestIdx].net) bestIdx = i;
    if (c.net < comparisons[worstIdx].net) worstIdx = i;
  });

  return { bestYearIndex: bestIdx, worstYearIndex: worstIdx };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecapPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const year = parseInt(params.year as string);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [multiYearTransactions, setMultiYearTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [monthlyWealth, setMonthlyWealth] = useState<Array<{ investments: number; savings: number }>>([]);

  const startYear = year - COMPARISON_RANGE;
  const endYear = year + COMPARISON_RANGE;

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      toast.error('Anno non valido');
      router.push('/dashboard');
      return;
    }

    loadYearData();
  }, [user, year]);

  const loadYearData = useCallback(async (isRetry = false) => {
    if (!user) return;

    setIsLoading(true);
    setHasError(false);

    try {
      // Load current year transactions, multi-year transactions, and wealth data in parallel
      const [currentResult, multiResult, wealthResult] = await Promise.allSettled([
        supabase
          .from('transactions')
          .select('id, type, amount, category, start_date, categories(name)')
          .eq('user_id', user.id)
          .gte('start_date', `${year}-01-01`)
          .lte('start_date', `${year}-12-31`)
          .order('start_date', { ascending: true }),
        supabase
          .from('transactions')
          .select('id, type, amount, category, start_date, categories(name)')
          .eq('user_id', user.id)
          .gte('start_date', `${startYear}-01-01`)
          .lte('start_date', `${endYear}-12-31`)
          .order('start_date', { ascending: true }),
        calculateWealthForYear(user.id, year),
      ]);

      // Handle current year transactions (graceful degradation)
      if (currentResult.status === 'fulfilled') {
        if (currentResult.value.error) {
          console.error('Error fetching transactions:', currentResult.value.error);
          toast.error('Errore nel caricamento delle transazioni');
        } else {
          const mappedData = (currentResult.value.data || []).map(t => ({
            ...t,
            category_name: (t.categories as any)?.name || 'Unknown',
          }));
          setTransactions(mappedData as Transaction[]);
        }
      } else {
        console.error('Error fetching transactions:', currentResult.reason);
        toast.error('Errore di connessione per le transazioni');
      }

      // Handle multi-year transactions (graceful degradation)
      if (multiResult.status === 'fulfilled') {
        if (multiResult.value.error) {
          console.error('Error fetching multi-year transactions:', multiResult.value.error);
        } else {
          const mappedMulti = (multiResult.value.data || []).map(t => ({
            ...t,
            category_name: (t.categories as any)?.name || 'Unknown',
          }));
          setMultiYearTransactions(mappedMulti as Transaction[]);
        }
      } else {
        console.error('Error fetching multi-year transactions:', multiResult.reason);
      }

      // Handle wealth data (graceful degradation)
      if (wealthResult.status === 'fulfilled') {
        setMonthlyWealth(wealthResult.value);
      } else {
        console.error('Error loading wealth data:', wealthResult.reason);
        toast.error('Errore nel caricamento dei dati patrimonio');
      }

      if (isRetry) {
        toast.success('Dati caricati con successo!');
      }
    } catch (error) {
      console.error('Error loading year data:', error);
      setHasError(true);

      if (!isRetry) {
        toast.error('Errore nel caricamento dei dati. Puoi riprovare.');
      } else {
        toast.error('Errore di connessione, riprova tra qualche secondo.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, year, startYear, endYear]);

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    loadYearData(true);
  }, [loadYearData]);

  // ---------------------------------------------------------------------------
  // Current-year aggregations (existing)
  // ---------------------------------------------------------------------------

  const aggregateByMonth = (): MonthlyData[] => {
    const monthlyData: MonthlyData[] = MONTH_LABELS.map((label) => ({
      month: label,
      income: 0,
      expenses: 0,
      investments: 0,
    }));

    transactions.forEach(t => {
      const date = new Date(t.start_date);
      const monthIndex = date.getMonth();

      // Check category first - investments are tracked separately
      if (t.category_name === 'Investimenti') {
        // Investment transactions (both expense and income types add to balance)
        monthlyData[monthIndex].investments += t.amount;
      } else if (t.type === 'income') {
        // Regular income (not investments)
        monthlyData[monthIndex].income += t.amount;
      } else if (t.type === 'expense') {
        // Regular expenses (not investments)
        monthlyData[monthIndex].expenses += t.amount;
      }
    });

    // No longer need hardcoded calculation - investments are actual transactions
    return monthlyData;
  };

  const calculateInsights = (monthlyData: MonthlyData[]): AnnualInsightsData => {
    const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
    const totalExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0);
    const totalInvestments = monthlyData.reduce((sum, m) => sum + m.investments, 0);

    const monthsWithIncome = monthlyData.filter(m => m.income > 0).length;
    const avgSavingsRate = monthsWithIncome > 0
      ? (totalInvestments / totalIncome) * 100
      : 0;

    let bestMonth = { label: 'N/A', net: 0 };
    let worstMonth = { label: 'N/A', net: 0 };

    monthlyData.forEach((m, index) => {
      const net = m.income - m.expenses;
      if (index === 0 || net > bestMonth.net) {
        bestMonth = { label: MONTH_LABELS_FULL[index], net };
      }
      if (index === 0 || net < worstMonth.net) {
        worstMonth = { label: MONTH_LABELS_FULL[index], net };
      }
    });

    return {
      totalIncome,
      totalExpenses,
      totalInvestments,
      avgSavingsRate,
      bestMonth,
      worstMonth,
    };
  };

  const aggregateByCategory = (): CategoryData[] => {
    const categoryMap = new Map<string, number>();

    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const name = t.category_name || 'Unknown';
        categoryMap.set(name, (categoryMap.get(name) || 0) + t.amount);
      });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  };

  // ---------------------------------------------------------------------------
  // Multi-year aggregations (new)
  // ---------------------------------------------------------------------------

  const yearlyComparisons = useMemo((): YearComparison[] => {
    if (multiYearTransactions.length === 0) return [];

    // Group transactions by year
    const yearMap = new Map<number, YearlySummary>();

    for (let y = startYear; y <= endYear; y++) {
      yearMap.set(y, { year: y, income: 0, expenses: 0, net: 0 });
    }

    multiYearTransactions.forEach(t => {
      const txYear = new Date(t.start_date).getFullYear();
      const summary = yearMap.get(txYear);
      if (!summary) return;

      if (t.type === 'income') {
        summary.income += t.amount;
      } else {
        summary.expenses += t.amount;
      }
    });

    // Calculate net for each year
    yearMap.forEach(s => {
      s.net = s.income - s.expenses;
    });

    // Filter years that have at least some data
    const summaries = Array.from(yearMap.values())
      .filter(s => s.income > 0 || s.expenses > 0)
      .sort((a, b) => a.year - b.year);

    if (summaries.length <= 1) return [];

    return buildYearComparisons(summaries);
  }, [multiYearTransactions, startYear, endYear]);

  const multiYearInsights = useMemo((): MultiYearInsights => {
    if (yearlyComparisons.length === 0) return { bestYearIndex: 0, worstYearIndex: 0 };
    return calculateMultiYearInsights(yearlyComparisons);
  }, [yearlyComparisons]);

  /** Category breakdown aggregated across the entire multi-year range. */
  const multiYearCategoryData = useMemo((): CategoryData[] => {
    const categoryMap = new Map<string, number>();

    multiYearTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const name = t.category_name || 'Unknown';
        categoryMap.set(name, (categoryMap.get(name) || 0) + t.amount);
      });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [multiYearTransactions]);

  /** Determine the actual year range that contains data for the section header. */
  const multiYearRange = useMemo(() => {
    if (yearlyComparisons.length === 0) return null;
    const first = yearlyComparisons[0].year;
    const last = yearlyComparisons[yearlyComparisons.length - 1].year;
    return { start: first, end: last };
  }, [yearlyComparisons]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handlePrevYear = () => {
    router.push(`/dashboard/${year - 1}/recap`);
  };

  const handleNextYear = () => {
    router.push(`/dashboard/${year + 1}/recap`);
  };

  const handleBack = () => {
    const currentMonth = new Date().getMonth() + 1;
    router.push(`/dashboard/${year}/${String(currentMonth).padStart(2, '0')}`);
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-warmBg-primary flex items-center justify-center">
        {/* Skeleton loading - warm theme */}
        <div className="w-full max-w-2xl p-4 space-y-4">
          <div className="h-8 w-48 bg-warmBg-secondary rounded-2xl animate-pulse mx-auto" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 bg-warmBg-secondary rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-72 bg-warmBg-secondary rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const monthlyData = aggregateByMonth();
  const insightsData = calculateInsights(monthlyData);
  const categoryData = aggregateByCategory();

  const hasTransactions = transactions.length > 0;
  const hasMultiYearData = yearlyComparisons.length > 1;
  const hasMultiYearExpenses = multiYearCategoryData.length > 0 && hasMultiYearData;

  // Calculate wealth summary for the year
  const startYearWealth = monthlyWealth[0] || { investments: 0, savings: 0 };
  const endYearWealth = monthlyWealth[11] || { investments: 0, savings: 0 };
  const totalStartWealth = startYearWealth.investments + startYearWealth.savings;
  const totalEndWealth = endYearWealth.investments + endYearWealth.savings;
  const wealthDelta = totalEndWealth - totalStartWealth;
  const wealthGrowthPercent = totalStartWealth > 0 ? (wealthDelta / totalStartWealth) * 100 : 0;
  const hasWealthData = monthlyWealth.some(w => w.investments > 0 || w.savings > 0);

  return (
    <div className="min-h-screen bg-warmBg-primary">
      <header className="sticky top-0 bg-warmBg-primary border-b border-warmText-muted/20 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-warmText-secondary hover:text-warmText-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Torna al Dashboard</span>
            </button>
            <button
              onClick={() => {
                const currentYear = new Date().getFullYear();
                router.push(`/dashboard/recap?start=${currentYear - 2}&end=${currentYear}`);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-warmText-tertiary hover:text-warmText-secondary hover:bg-warmBg-tertiary transition-all active:scale-95"
              title="Recap Multi-Anno"
              aria-label="Vai al Recap Multi-Anno"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Multi-Anno</span>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevYear}
              className="p-2 hover:bg-warmBg-tertiary rounded-xl transition-colors active:scale-95"
              aria-label="Anno precedente"
            >
              <ChevronLeft className="w-5 h-5 text-warmText-secondary" />
            </button>

            <h1 className="text-2xl font-bold text-warmText-primary">
              Riepilogo {year}
            </h1>

            <button
              onClick={handleNextYear}
              className="p-2 hover:bg-warmBg-tertiary rounded-xl transition-colors active:scale-95"
              aria-label="Anno successivo"
            >
              <ChevronRight className="w-5 h-5 text-warmText-secondary" />
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 pb-8 space-y-6">
        {!hasTransactions ? (
          <div className="bg-warmBg-secondary rounded-3xl p-12 text-center">
            <p className="text-warmText-tertiary mb-2">
              Nessuna transazione per il {year}
            </p>
            <p className="text-sm text-warmText-disabled">
              Aggiungi transazioni per vedere l&apos;analisi annuale
            </p>
          </div>
        ) : (
          <>
            {/* Current year insights */}
            <AnnualInsights data={insightsData} year={year} />

            {/* Wealth Section */}
            {hasWealthData && (
              <div className="bg-warmBg-secondary rounded-3xl p-6">
                <h3 className="text-xl font-bold text-warmText-primary mb-4">
                  Andamento Patrimonio
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-warmBg-primary rounded-2xl p-4">
                    <p className="text-sm text-warmText-tertiary mb-1">Inizio Anno</p>
                    <p className="text-2xl font-bold text-warmText-primary">
                      &euro;{totalStartWealth.toFixed(0)}
                    </p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-warmData-investment">
                        Inv &euro;{startYearWealth.investments.toFixed(0)}
                      </span>
                      <span className="text-blue-500">
                        Sav &euro;{startYearWealth.savings.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-warmBg-primary rounded-2xl p-4">
                    <p className="text-sm text-warmText-tertiary mb-1">Fine Anno</p>
                    <p className="text-2xl font-bold text-warmText-primary">
                      &euro;{totalEndWealth.toFixed(0)}
                    </p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-warmData-investment">
                        Inv &euro;{endYearWealth.investments.toFixed(0)}
                      </span>
                      <span className="text-blue-500">
                        Sav &euro;{endYearWealth.savings.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-warmBg-primary rounded-2xl p-4">
                    <p className="text-sm text-warmText-tertiary mb-1">Crescita</p>
                    <p className={`text-2xl font-bold ${wealthDelta >= 0 ? 'text-warmData-income' : 'text-warmData-expense'}`}>
                      {wealthDelta >= 0 ? '+' : ''}&euro;{wealthDelta.toFixed(0)}
                    </p>
                    <p className={`text-xs mt-1 ${wealthDelta >= 0 ? 'text-warmData-income' : 'text-warmData-expense'}`}>
                      {wealthGrowthPercent >= 0 ? '+' : ''}{wealthGrowthPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Annual trend chart */}
            <AnnualTrendChart
              data={monthlyData}
              monthlyInvestments={monthlyWealth.map(w => w.investments)}
              monthlySavings={monthlyWealth.map(w => w.savings)}
            />

            {/* Current year category breakdown */}
            <CategoryBreakdownChart data={categoryData} />

            {/* ---------------------------------------------------------- */}
            {/* Multi-Year Section                                          */}
            {/* ---------------------------------------------------------- */}
            {hasMultiYearData && (
              <>
                {/* Section divider */}
                <div className="flex items-center gap-3 pt-4">
                  <div className="flex-1 border-t border-warmText-muted/20" />
                  <span className="text-xs font-medium text-warmText-tertiary uppercase tracking-wider">
                    Analisi Multi-Anno
                  </span>
                  <div className="flex-1 border-t border-warmText-muted/20" />
                </div>

                {/* Year-over-Year Comparison Cards with Best/Worst badges */}
                <YearComparisonCards
                  data={yearlyComparisons}
                  insights={multiYearInsights}
                />

                {/* Multi-year category breakdown */}
                {hasMultiYearExpenses && multiYearRange && (
                  <div className="bg-warmBg-secondary rounded-3xl p-6">
                    <h3 className="text-lg font-semibold text-warmText-primary mb-4">
                      Distribuzione Spese {multiYearRange.start}-{multiYearRange.end}
                    </h3>
                    <CategoryBreakdownChart data={multiYearCategoryData} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
