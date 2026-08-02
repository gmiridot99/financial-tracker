'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronDown,
  BarChart3,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { calculateWealthForYears } from '@/lib/wealth';
import { computeWealthPeriodSummary } from '@/hooks/recap/wealthPeriodSummary';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import type { YearlyDataPoint } from '@/components/MultiYearTrendChart';
const MultiYearTrendChart = dynamic(() => import('@/components/MultiYearTrendChart'), { ssr: false });
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────────────────────

interface YearWealthSummary {
  year: number;
  startWealth: { investments: number; savings: number };
  endWealth: { investments: number; savings: number };
  totalStart: number;
  totalEnd: number;
  delta: number;
  growthPercent: number;
  hasTransactions: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────

const MIN_YEAR = 2020;
const MAX_RANGE_YEARS = 10;
const DEBOUNCE_DELAY = 300;

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getMaxYear(): number {
  return getCurrentYear() + 1;
}

function generateYearOptions(): number[] {
  const maxYear = getMaxYear();
  const years: number[] = [];
  for (let y = MIN_YEAR; y <= maxYear; y++) {
    years.push(y);
  }
  return years;
}

function generateYearsInRange(start: number, end: number): number[] {
  const years: number[] = [];
  for (let y = start; y <= end; y++) {
    years.push(y);
  }
  return years;
}

// ── Skeleton Components ───────────────────────────────────────────────

function SkeletonYearCard() {
  return (
    <div className="bg-warmBg-secondary rounded-3xl p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-16 bg-warmBg-tertiary rounded-full" />
        <div className="h-6 w-20 bg-warmBg-tertiary rounded-full" />
      </div>
      <div className="h-9 w-36 bg-warmBg-tertiary rounded-full mb-2" />
      <div className="h-4 w-28 bg-warmBg-tertiary rounded-full mb-4" />
      <div className="flex gap-4">
        <div className="h-3 w-20 bg-warmBg-tertiary rounded-full" />
        <div className="h-3 w-20 bg-warmBg-tertiary rounded-full" />
      </div>
    </div>
  );
}

function SkeletonAggregateSummary() {
  return (
    <div className="bg-warmBg-secondary rounded-3xl p-6 mb-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-warmBg-tertiary rounded-2xl" />
        <div className="h-3 w-40 bg-warmBg-tertiary rounded-full" />
      </div>
      <div className="h-11 w-48 bg-warmBg-tertiary rounded-full mb-3" />
      <div className="flex gap-3">
        <div className="h-7 w-28 bg-warmBg-tertiary rounded-full" />
        <div className="h-5 w-24 bg-warmBg-tertiary rounded-full" />
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-warmBg-secondary rounded-3xl p-6 mb-6 animate-pulse">
      <div className="h-5 w-48 bg-warmBg-tertiary rounded-full mb-6" />
      <div className="h-72 bg-warmBg-tertiary rounded-2xl" />
    </div>
  );
}

function SkeletonWealthEvolution() {
  return (
    <div className="mb-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-warmBg-tertiary rounded" />
        <div className="h-5 w-44 bg-warmBg-tertiary rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-warmBg-secondary rounded-3xl p-6">
            <div className="h-3 w-28 bg-warmBg-tertiary rounded-full mb-3" />
            <div className="h-9 w-32 bg-warmBg-tertiary rounded-full mb-2" />
            <div className="flex gap-3">
              <div className="h-3 w-16 bg-warmBg-tertiary rounded-full" />
              <div className="h-3 w-16 bg-warmBg-tertiary rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonAggregateSummary />
      <div>
        <div className="h-5 w-36 bg-warmBg-tertiary rounded-full mb-4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <SkeletonYearCard key={i} />
          ))}
        </div>
      </div>
      <SkeletonWealthEvolution />
      <SkeletonChart />
    </div>
  );
}

// ── Empty State Component ──────────────────────────────────────────────

function EmptyState({
  startYear,
  endYear,
  onGoToDashboard,
}: {
  startYear: number;
  endYear: number;
  onGoToDashboard: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6"
      style={{
        animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        opacity: 0,
      }}
    >
      <div className="w-16 h-16 bg-warmAccent-primary/15 rounded-full flex items-center justify-center mb-6">
        <Wallet className="w-8 h-8 text-warmAccent-primary" />
      </div>

      <h3 className="text-xl font-bold text-warmText-primary mb-2 text-center">
        Nessuna transazione nel periodo {startYear}-{endYear}
      </h3>

      <p className="text-sm text-warmText-tertiary mb-8 text-center max-w-sm leading-relaxed">
        Aggiungi transazioni per vedere l&apos;analisi multi-anno.
        I dati appariranno qui non appena inizierai a tracciare le tue finanze.
      </p>

      <button
        onClick={onGoToDashboard}
        className="px-6 py-3 bg-warmAccent-primary text-white font-semibold text-sm rounded-full hover:bg-warmAccent-hover transition-all active:scale-95 shadow-lg shadow-warmAccent-primary/25"
        aria-label="Vai al dashboard"
      >
        Vai al Dashboard
      </button>
    </div>
  );
}

// ── Gap Years Warning ──────────────────────────────────────────────────

function GapYearsWarning({ missingYears }: { missingYears: number[] }) {
  if (missingYears.length === 0) return null;

  const yearsList = missingYears.join(', ');

  return (
    <div
      className="flex items-start gap-3 bg-warmAccent-primary/10 border border-warmAccent-primary/25 rounded-2xl px-5 py-4 mb-6"
      role="alert"
      style={{
        animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        opacity: 0,
        animationDelay: '100ms',
      }}
    >
      <AlertTriangle className="w-5 h-5 text-warmAccent-primary flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-warmText-primary mb-0.5">
          Attenzione: dati mancanti per {yearsList}
        </p>
        <p className="text-xs text-warmText-tertiary leading-relaxed">
          Alcuni anni nel periodo selezionato non hanno transazioni.
          L&apos;analisi mostra solo gli anni con dati disponibili.
        </p>
      </div>
    </div>
  );
}

// ── Year Card Component ────────────────────────────────────────────────

function YearCard({
  summary,
  index,
}: {
  summary: YearWealthSummary;
  index: number;
}) {
  const isPositive = summary.delta >= 0;
  const isEmpty = !summary.hasTransactions && summary.totalEnd === 0 && summary.totalStart === 0;

  if (isEmpty) {
    return (
      <div
        className="bg-warmBg-secondary rounded-3xl p-6 border border-dashed border-warmText-muted/30"
        style={{
          animationDelay: `${index * 80}ms`,
          animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
          opacity: 0,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-warmText-tertiary tracking-wide">
            {summary.year}
          </span>
          <span className="text-xs text-warmText-disabled px-3 py-1 bg-warmBg-tertiary rounded-full">
            Nessun dato
          </span>
        </div>
        <p className="text-sm text-warmText-disabled leading-relaxed">
          Nessuna transazione registrata per quest&apos;anno
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-warmBg-secondary rounded-3xl p-6 hover:bg-warmBg-tertiary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      style={{
        animationDelay: `${index * 80}ms`,
        animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        opacity: 0,
      }}
    >
      {/* Year Label */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-warmText-tertiary tracking-wide">
          {summary.year}
        </span>
        <div
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
            isPositive
              ? 'bg-warmData-income/15 text-warmData-income'
              : 'bg-warmData-expense/15 text-warmData-expense'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {isPositive ? '+' : ''}
          {summary.growthPercent.toFixed(1)}%
        </div>
      </div>

      {/* End-of-Year Wealth */}
      <p className="text-3xl font-bold text-warmText-primary mb-1 tracking-tight">
        {summary.totalEnd.toLocaleString('it-IT', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0,
        })}
      </p>

      {/* Delta */}
      <p
        className={`text-sm font-medium mb-4 ${
          isPositive ? 'text-warmData-income' : 'text-warmData-expense'
        }`}
      >
        {isPositive ? '+' : ''}
        {summary.delta.toLocaleString('it-IT', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0,
        })}{' '}
        nell&apos;anno
      </p>

      {/* Breakdown */}
      <div className="flex gap-4 text-xs text-warmText-tertiary">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-warmData-investment" />
          <span>
            Inv{' '}
            {summary.endWealth.investments.toLocaleString('it-IT', {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-warmData-savings" />
          <span>
            Risp{' '}
            {summary.endWealth.savings.toLocaleString('it-IT', {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Custom Select Component ────────────────────────────────────────────

function YearSelect({
  value,
  onChange,
  label,
  options,
  disabledOptions,
}: {
  value: number;
  onChange: (year: number) => void;
  label: string;
  options: number[];
  disabledOptions?: Set<number>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-warmText-tertiary tracking-wide uppercase">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="appearance-none bg-warmBg-tertiary text-warmText-primary font-semibold text-base md:text-lg pl-5 pr-10 py-3 rounded-2xl border border-warmText-muted/20 focus:border-warmAccent-primary focus:outline-none focus:ring-2 focus:ring-warmAccent-primary/20 transition-all cursor-pointer w-full min-w-[120px]"
          aria-label={label}
        >
          {options.map((y) => (
            <option
              key={y}
              value={y}
              disabled={disabledOptions?.has(y)}
            >
              {y}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmText-tertiary pointer-events-none" />
      </div>
    </div>
  );
}

// ── Validation Message Component ───────────────────────────────────────

function ValidationMessage({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      className="flex items-center gap-2 text-warmData-expense text-xs font-medium mt-2 px-1"
      role="alert"
      style={{
        animation: 'slideInUp 200ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        opacity: 0,
      }}
    >
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ── Main Page Content (uses useSearchParams) ───────────────────────────

function RecapMultiAnnoContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse URL params with defaults (last 3 years)
  const currentYear = getCurrentYear();
  const defaultStart = currentYear - 2;
  const defaultEnd = currentYear;

  const urlStart = searchParams.get('start');
  const urlEnd = searchParams.get('end');

  const initialStart = urlStart ? parseInt(urlStart) : defaultStart;
  const initialEnd = urlEnd ? parseInt(urlEnd) : defaultEnd;

  // Local state for the dropdown selections (before user clicks "Visualizza")
  const [selectedStart, setSelectedStart] = useState<number>(initialStart);
  const [selectedEnd, setSelectedEnd] = useState<number>(initialEnd);

  // The active range currently being displayed
  const [activeStart, setActiveStart] = useState<number>(initialStart);
  const [activeEnd, setActiveEnd] = useState<number>(initialEnd);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [yearSummaries, setYearSummaries] = useState<YearWealthSummary[]>([]);
  const [yearlyChartData, setYearlyChartData] = useState<YearlyDataPoint[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // Debounce ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yearOptions = useMemo(() => generateYearOptions(), []);

  // Compute disabled options for end year (based on selected start, max 10 year range)
  const disabledEndOptions = useMemo(() => {
    const disabled = new Set<number>();
    yearOptions.forEach((y) => {
      if (y < selectedStart) disabled.add(y);
      if (y - selectedStart + 1 > MAX_RANGE_YEARS) disabled.add(y);
    });
    return disabled;
  }, [selectedStart, yearOptions]);

  // Compute disabled options for start year (based on selected end, max 10 year range)
  const disabledStartOptions = useMemo(() => {
    const disabled = new Set<number>();
    yearOptions.forEach((y) => {
      if (y > selectedEnd) disabled.add(y);
      if (selectedEnd - y + 1 > MAX_RANGE_YEARS) disabled.add(y);
    });
    return disabled;
  }, [selectedEnd, yearOptions]);

  // Validation helper
  const validateRange = useCallback(
    (start: number, end: number): string | null => {
      if (isNaN(start) || isNaN(end)) {
        return 'Seleziona anni validi';
      }
      if (start > end) {
        return "L'anno di inizio deve essere precedente o uguale all'anno di fine";
      }
      if (end - start + 1 > MAX_RANGE_YEARS) {
        return `Puoi selezionare al massimo ${MAX_RANGE_YEARS} anni`;
      }
      if (start < MIN_YEAR || end > getMaxYear()) {
        return `Seleziona anni tra ${MIN_YEAR} e ${getMaxYear()}`;
      }
      return null;
    },
    []
  );

  // Real-time validation on selector change (debounced)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const error = validateRange(selectedStart, selectedEnd);
      setValidationMessage(error);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [selectedStart, selectedEnd, validateRange]);

  // Auto-correct end year when start changes
  const handleStartChange = useCallback(
    (newStart: number) => {
      setSelectedStart(newStart);
      // If new start exceeds end, adjust end
      if (newStart > selectedEnd) {
        setSelectedEnd(newStart);
      }
      // If range exceeds max, clamp end
      if (selectedEnd - newStart + 1 > MAX_RANGE_YEARS) {
        setSelectedEnd(newStart + MAX_RANGE_YEARS - 1);
      }
    },
    [selectedEnd]
  );

  // Auto-correct start year when end changes
  const handleEndChange = useCallback(
    (newEnd: number) => {
      setSelectedEnd(newEnd);
      // If new end is before start, adjust start
      if (newEnd < selectedStart) {
        setSelectedStart(newEnd);
      }
      // If range exceeds max, clamp start
      if (newEnd - selectedStart + 1 > MAX_RANGE_YEARS) {
        setSelectedStart(newEnd - MAX_RANGE_YEARS + 1);
      }
    },
    [selectedStart]
  );

  // Load data for the active range
  const loadData = useCallback(
    async (start: number, end: number, isRetry = false) => {
      if (!user) return;

      setIsLoading(true);
      setHasError(false);

      try {
        const years = generateYearsInRange(start, end);

        // Fetch wealth data and transactions in parallel for better performance
        const [wealthMap, transResult] = await Promise.allSettled([
          calculateWealthForYears(user.id, years),
          supabase
            .from('transactions')
            .select('type, amount, start_date')
            .eq('user_id', user.id)
            .gte('start_date', `${start}-01-01`)
            .lte('start_date', `${end}-12-31`),
        ]);

        // Handle wealth data (graceful degradation)
        let resolvedWealthMap: Map<number, Array<{ investments: number; savings: number }>> = new Map();
        if (wealthMap.status === 'fulfilled') {
          resolvedWealthMap = wealthMap.value;
        } else {
          console.error('Error loading wealth data:', wealthMap.reason);
          toast.error('Errore nel caricamento dei dati patrimonio. Mostro dati parziali.');
        }

        // Handle transaction data (graceful degradation)
        let transactions: Array<{ type: string; amount: number; start_date: string }> = [];
        if (transResult.status === 'fulfilled') {
          if (transResult.value.error) {
            console.error('Error fetching transactions:', transResult.value.error);
            toast.error('Errore nel caricamento delle transazioni. Mostro dati parziali.');
          } else {
            transactions = transResult.value.data || [];
          }
        } else {
          console.error('Error fetching transactions:', transResult.reason);
          toast.error('Errore di connessione. Mostro dati parziali.');
        }

        // Aggregate income and expenses by year
        const incomeByYear = new Map<number, number>();
        const expensesByYear = new Map<number, number>();
        const yearsWithTransactions = new Set<number>();

        for (const t of transactions) {
          try {
            const tYear = new Date(t.start_date).getFullYear();
            yearsWithTransactions.add(tYear);
            if (t.type === 'income') {
              incomeByYear.set(tYear, (incomeByYear.get(tYear) || 0) + Number(t.amount));
            } else if (t.type === 'expense') {
              expensesByYear.set(tYear, (expensesByYear.get(tYear) || 0) + Number(t.amount));
            }
          } catch (parseError) {
            console.error('Error parsing transaction data:', parseError);
          }
        }

        const summaries: YearWealthSummary[] = years.map((y) => {
          const monthlyData = resolvedWealthMap.get(y);
          const { startWealth, endWealth, totalStart, totalEnd, delta, growthPercent } =
            computeWealthPeriodSummary(monthlyData);

          return {
            year: y,
            startWealth,
            endWealth,
            totalStart,
            totalEnd,
            delta,
            growthPercent,
            hasTransactions: yearsWithTransactions.has(y),
          };
        });

        setYearSummaries(summaries);

        // Build chart data points for MultiYearTrendChart
        const chartPoints: YearlyDataPoint[] = years.map((y) => {
          const monthlyData = resolvedWealthMap.get(y) || Array.from({ length: 12 }, () => ({ investments: 0, savings: 0 }));
          const endOfYear = monthlyData[11];
          return {
            year: String(y),
            income: Math.round(incomeByYear.get(y) || 0),
            expenses: Math.round(expensesByYear.get(y) || 0),
            wealthInvestments: Math.round(endOfYear.investments),
            wealthSavings: Math.round(endOfYear.savings),
          };
        });
        setYearlyChartData(chartPoints);

        if (isRetry) {
          toast.success('Dati caricati con successo!');
        }
      } catch (error) {
        console.error('Error loading multi-year data:', error);
        setHasError(true);

        if (!isRetry) {
          toast.error('Errore nel caricamento dei dati. Puoi riprovare.');
        } else {
          toast.error('Errore di connessione, riprova tra qualche secondo.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Retry handler
  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    loadData(activeStart, activeEnd, true);
  }, [loadData, activeStart, activeEnd]);

  // Initial load and URL sync
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    // Validate the initial range from URL
    const validationError = validateRange(initialStart, initialEnd);
    if (validationError) {
      toast.error(validationError);
      // Fall back to defaults
      setSelectedStart(defaultStart);
      setSelectedEnd(defaultEnd);
      setActiveStart(defaultStart);
      setActiveEnd(defaultEnd);
      router.push(`/dashboard/recap?start=${defaultStart}&end=${defaultEnd}`);
      loadData(defaultStart, defaultEnd);
    } else {
      setSelectedStart(initialStart);
      setSelectedEnd(initialEnd);
      setActiveStart(initialStart);
      setActiveEnd(initialEnd);
      loadData(initialStart, initialEnd);
    }
  }, [user, authLoading]);

  // Handle "Visualizza" click
  const handleApply = useCallback(() => {
    const validationError = validateRange(selectedStart, selectedEnd);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setActiveStart(selectedStart);
    setActiveEnd(selectedEnd);
    router.push(`/dashboard/recap?start=${selectedStart}&end=${selectedEnd}`);
    loadData(selectedStart, selectedEnd);
  }, [selectedStart, selectedEnd, validateRange, router, loadData]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    const month = new Date().getMonth() + 1;
    router.push(
      `/dashboard/${currentYear}/${String(month).padStart(2, '0')}`
    );
  }, [router, currentYear]);

  // Check if the selector has changed from the active range
  const hasChanges = selectedStart !== activeStart || selectedEnd !== activeEnd;

  // Compute aggregate stats (memoized)
  const aggregateStats = useMemo(() => {
    if (yearSummaries.length === 0) return null;

    const first = yearSummaries[0];
    const last = yearSummaries[yearSummaries.length - 1];
    const totalDelta = last.totalEnd - first.totalStart;
    const overallGrowth =
      first.totalStart > 0 ? (totalDelta / first.totalStart) * 100 : 0;

    return {
      periodStart: first.totalStart,
      periodEnd: last.totalEnd,
      totalDelta,
      overallGrowth,
      years: yearSummaries.length,
    };
  }, [yearSummaries]);

  // Detect gap years (years without transactions within the range)
  const missingYears = useMemo(() => {
    if (yearSummaries.length === 0) return [];

    const yearsWithData = yearSummaries.filter(
      (s) => s.hasTransactions || s.totalEnd > 0 || s.totalStart > 0
    );

    if (yearsWithData.length === 0) return [];
    if (yearsWithData.length === yearSummaries.length) return [];

    return yearSummaries
      .filter((s) => !s.hasTransactions && s.totalEnd === 0 && s.totalStart === 0)
      .map((s) => s.year);
  }, [yearSummaries]);

  // Check if all years are empty
  const allEmpty = useMemo(() => {
    return yearSummaries.every(
      (s) => !s.hasTransactions && s.totalEnd === 0 && s.totalStart === 0
    );
  }, [yearSummaries]);

  // Check if any year has meaningful data
  const hasAnyData = useMemo(() => {
    return yearSummaries.some(
      (s) => s.hasTransactions || s.totalEnd > 0 || s.totalStart > 0
    );
  }, [yearSummaries]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-warmBg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-warmAccent-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-warmText-tertiary text-sm">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warmBg-primary">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 bg-warmBg-primary/95 backdrop-blur-md border-b border-warmText-muted/10 z-10">
        <div className="px-4 py-4 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-warmText-secondary hover:text-warmText-primary transition-colors active:scale-95"
              aria-label="Torna al Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Dashboard</span>
            </button>
          </div>

          <h1 className="text-2xl font-bold text-warmText-primary mb-5 tracking-tight">
            Recap Multi-Anno
          </h1>

          {/* ── Range Selector ────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-3">
            <YearSelect
              value={selectedStart}
              onChange={handleStartChange}
              label="Anno Inizio"
              options={yearOptions}
              disabledOptions={disabledStartOptions}
            />

            <div className="flex items-center pb-3 text-warmText-disabled">
              <ArrowRight className="w-5 h-5" />
            </div>

            <YearSelect
              value={selectedEnd}
              onChange={handleEndChange}
              label="Anno Fine"
              options={yearOptions}
              disabledOptions={disabledEndOptions}
            />

            <button
              onClick={handleApply}
              disabled={!!validationMessage}
              className={`px-6 py-3 rounded-full font-semibold text-sm transition-all active:scale-95 mb-0 self-end ${
                validationMessage
                  ? 'bg-warmBg-tertiary text-warmText-disabled cursor-not-allowed opacity-60'
                  : hasChanges
                    ? 'bg-warmAccent-primary text-white hover:bg-warmAccent-hover shadow-lg shadow-warmAccent-primary/25'
                    : 'bg-warmBg-tertiary text-warmText-secondary hover:bg-warmBg-hover'
              }`}
              aria-label="Applica selezione anni"
            >
              Visualizza
            </button>
          </div>

          {/* Real-time validation feedback */}
          <ValidationMessage message={validationMessage} />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="px-4 py-6 max-w-5xl mx-auto pb-12">
        {isLoading ? (
          <LoadingSkeleton />
        ) : hasError ? (
          /* ── Error State with Retry ─────────────────────────────── */
          <div
            className="flex flex-col items-center justify-center py-16 px-6"
            style={{
              animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
              opacity: 0,
            }}
          >
            <div className="w-16 h-16 bg-warmData-expense/15 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-warmData-expense" />
            </div>

            <h3 className="text-xl font-bold text-warmText-primary mb-2 text-center">
              Impossibile caricare i dati
            </h3>

            <p className="text-sm text-warmText-tertiary mb-8 text-center max-w-sm leading-relaxed">
              Si e&apos; verificato un errore durante il caricamento.
              Controlla la connessione e riprova.
            </p>

            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-6 py-3 bg-warmAccent-primary text-white font-semibold text-sm rounded-full hover:bg-warmAccent-hover transition-all active:scale-95 shadow-lg shadow-warmAccent-primary/25"
              aria-label="Riprova caricamento"
            >
              <RefreshCw className="w-4 h-4" />
              Riprova
              {retryCount > 0 && (
                <span className="text-xs opacity-70">
                  ({retryCount})
                </span>
              )}
            </button>
          </div>
        ) : allEmpty ? (
          /* ── Fully Empty State ──────────────────────────────────── */
          <EmptyState
            startYear={activeStart}
            endYear={activeEnd}
            onGoToDashboard={handleBack}
          />
        ) : (
          <>
            {/* ── Gap Years Warning ────────────────────────────────── */}
            <GapYearsWarning missingYears={missingYears} />

            {/* ── Aggregate Summary ───────────────────────────────── */}
            {aggregateStats && aggregateStats.periodEnd > 0 && (
              <div
                className="bg-warmBg-secondary rounded-3xl p-6 mb-6"
                style={{
                  animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
                  opacity: 0,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-warmAccent-primary/15 rounded-2xl">
                    <Wallet className="w-5 h-5 text-warmAccent-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-warmText-tertiary uppercase tracking-wide">
                      Patrimonio Totale ({activeStart} - {activeEnd})
                    </p>
                  </div>
                </div>

                <p className="text-3xl md:text-4xl font-bold text-warmText-primary tracking-tight mb-2">
                  {aggregateStats.periodEnd.toLocaleString('it-IT', {
                    style: 'currency',
                    currency: 'EUR',
                    maximumFractionDigits: 0,
                  })}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                      aggregateStats.totalDelta >= 0
                        ? 'bg-warmData-income/15 text-warmData-income'
                        : 'bg-warmData-expense/15 text-warmData-expense'
                    }`}
                  >
                    {aggregateStats.totalDelta >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {aggregateStats.totalDelta >= 0 ? '+' : ''}
                    {aggregateStats.totalDelta.toLocaleString('it-IT', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    })}
                  </span>

                  <span
                    className={`text-sm font-medium ${
                      aggregateStats.overallGrowth >= 0
                        ? 'text-warmData-income'
                        : 'text-warmData-expense'
                    }`}
                  >
                    {aggregateStats.overallGrowth >= 0 ? '+' : ''}
                    {aggregateStats.overallGrowth.toFixed(1)}% nel periodo
                  </span>
                </div>
              </div>
            )}

            {/* ── Year-by-Year Cards ─────────────────────────────── */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-warmText-primary mb-4">
                Dettaglio per Anno
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearSummaries.map((summary, index) => (
                  <YearCard
                    key={summary.year}
                    summary={summary}
                    index={index}
                  />
                ))}
              </div>
            </div>

            {/* ── Wealth Evolution Section ───────────────────────── */}
            {aggregateStats && aggregateStats.periodEnd > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-warmAccent-primary" />
                  <h2 className="text-lg font-semibold text-warmText-primary">
                    Evoluzione Patrimonio
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Start Period Card */}
                  <div
                    className="bg-warmBg-secondary rounded-3xl p-6 hover:bg-warmBg-tertiary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                    style={{
                      animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
                      opacity: 0,
                      animationDelay: '0ms',
                    }}
                  >
                    <p className="text-xs text-warmText-tertiary uppercase tracking-wide mb-3">
                      Inizio Periodo ({activeStart})
                    </p>
                    <p className="text-3xl font-bold text-warmText-primary tracking-tight mb-2">
                      {aggregateStats.periodStart.toLocaleString('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    <div className="flex gap-3 text-xs text-warmText-tertiary">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-warmData-investment" />
                        <span>Inv {yearSummaries[0]?.startWealth.investments.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-warmData-savings" />
                        <span>Risp {yearSummaries[0]?.startWealth.savings.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* End Period Card */}
                  <div
                    className="bg-warmBg-secondary rounded-3xl p-6 hover:bg-warmBg-tertiary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                    style={{
                      animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
                      opacity: 0,
                      animationDelay: '80ms',
                    }}
                  >
                    <p className="text-xs text-warmText-tertiary uppercase tracking-wide mb-3">
                      Fine Periodo ({activeEnd})
                    </p>
                    <p className="text-3xl font-bold text-warmText-primary tracking-tight mb-2">
                      {aggregateStats.periodEnd.toLocaleString('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    <div className="flex gap-3 text-xs text-warmText-tertiary">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-warmData-investment" />
                        <span>Inv {yearSummaries[yearSummaries.length - 1]?.endWealth.investments.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-warmData-savings" />
                        <span>Risp {yearSummaries[yearSummaries.length - 1]?.endWealth.savings.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Growth Card */}
                  <div
                    className="bg-warmBg-secondary rounded-3xl p-6 hover:bg-warmBg-tertiary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                    style={{
                      animation: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
                      opacity: 0,
                      animationDelay: '160ms',
                    }}
                  >
                    <p className="text-xs text-warmText-tertiary uppercase tracking-wide mb-3">
                      Crescita Totale
                    </p>
                    <p
                      className={`text-3xl font-bold tracking-tight mb-2 ${
                        aggregateStats.totalDelta >= 0
                          ? 'text-warmData-income'
                          : 'text-warmData-expense'
                      }`}
                    >
                      {aggregateStats.totalDelta >= 0 ? '+' : ''}
                      {aggregateStats.totalDelta.toLocaleString('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    <div
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                        aggregateStats.overallGrowth >= 0
                          ? 'bg-warmData-income/15 text-warmData-income'
                          : 'bg-warmData-expense/15 text-warmData-expense'
                      }`}
                    >
                      {aggregateStats.overallGrowth >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {aggregateStats.overallGrowth >= 0 ? '+' : ''}
                      {aggregateStats.overallGrowth.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Multi-Year Trend Chart ──────────────────────────── */}
            {yearlyChartData.length > 0 && hasAnyData && (
              <div className="mb-6">
                <MultiYearTrendChart data={yearlyChartData} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── Page Export with Suspense Boundary ──────────────────────────────────
// useSearchParams() requires a Suspense boundary in Next.js 14+ App Router

export default function RecapMultiAnnoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-warmBg-primary">
          <div className="px-4 py-6 max-w-5xl mx-auto">
            <div className="h-8 w-48 bg-warmBg-secondary rounded-2xl animate-pulse mb-6" />
            <LoadingSkeleton />
          </div>
        </div>
      }
    >
      <RecapMultiAnnoContent />
    </Suspense>
  );
}
