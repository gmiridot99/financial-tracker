'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Loader2 } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────

interface AssetPriceChartProps {
  symbol: string;
  avgPrice: number;
}

interface PricePoint {
  price_date: string;
  price_eur: number;
}

interface ChartDataPoint {
  date: string;
  label: string;
  price: number;
}

// ── Constants ────────────────────────────────────────────────────────

interface PeriodOption {
  key: string;
  label: string;
  days: number;
}

const PERIODS: PeriodOption[] = [
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '6m', label: '6M', days: 180 },
  { key: '1y', label: '1A', days: 365 },
  { key: 'max', label: 'MAX', days: 3650 },
];

const DEFAULT_PERIOD = '3m';

// Cool dark palette colors (matching tailwind.config)
const COLORS = {
  investment: '#A78BFA',
  investmentFaded: 'rgba(167, 139, 250, 0.08)',
  income: '#34D399',
  expense: '#F87171',
  gridStroke: 'rgba(26, 30, 38, 0.6)',
  axisText: '#5A6474',
  tooltipBg: '#12151A',
  tooltipBorder: '#1A1E26',
} as const;

// ── Helpers ──────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatPrice(value: number): string {
  return value.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Custom Tooltip ───────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  avgPrice: number;
}

function CustomTooltip({ active, payload, label, avgPrice }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const price = payload[0].value;
  const diff = price - avgPrice;
  const diffPct = avgPrice > 0 ? (diff / avgPrice) * 100 : 0;
  const isPositive = diff >= 0;

  return (
    <div
      className="rounded-xl shadow-lg px-3 py-2 text-xs border"
      style={{
        backgroundColor: COLORS.tooltipBg,
        borderColor: COLORS.tooltipBorder,
      }}
    >
      <p className="text-warmText-tertiary mb-1">{formatFullDate(label)}</p>
      <p className="text-warmText-primary font-bold text-sm">{formatPrice(price)}</p>
      <p className={`mt-0.5 font-medium ${isPositive ? 'text-warmData-income' : 'text-warmData-expense'}`}>
        {isPositive ? '+' : ''}{formatPrice(diff)} ({isPositive ? '+' : ''}{diffPct.toFixed(1)}%)
      </p>
    </div>
  );
}

// ── Gradient offset calculation ─────────────────────────────────────

/**
 * Calculate the Y-axis offset (0-1) where avgPrice sits within the data range.
 * Used to transition the area fill from green (above) to red (below).
 */
function calculateGradientOffset(data: ChartDataPoint[], avgPrice: number): number {
  if (data.length === 0) return 0.5;

  const prices = data.map((d) => d.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);

  if (max === min) return 0.5;

  // offset is the fraction from the TOP where avgPrice sits
  const offset = (max - avgPrice) / (max - min);
  return Math.max(0, Math.min(1, offset));
}

// ── Main Component ───────────────────────────────────────────────────

export default function AssetPriceChart({ symbol, avgPrice }: AssetPriceChartProps) {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch price history when symbol or period changes
  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      const days = PERIODS.find((p) => p.key === period)?.days ?? 90;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authHeader: HeadersInit = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};
        const res = await fetch(`/api/assets/history?symbol=${encodeURIComponent(symbol)}&days=${days}`, { headers: authHeader });
        if (!res.ok) {
          throw new Error('Errore nel caricamento');
        }
        const data = await res.json();

        if (!cancelled) {
          setHistory(data.history ?? []);
        }
      } catch {
        if (!cancelled) {
          setError('Impossibile caricare lo storico prezzi');
          setHistory([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [symbol, period]);

  // Transform API data to chart-ready format
  const chartData: ChartDataPoint[] = useMemo(() => {
    return history.map((point) => ({
      date: point.price_date,
      label: formatDateLabel(point.price_date),
      price: point.price_eur,
    }));
  }, [history]);

  // Calculate gradient offset for the dual-color fill
  const gradientOffset = useMemo(() => {
    return calculateGradientOffset(chartData, avgPrice);
  }, [chartData, avgPrice]);

  // Determine Y-axis domain with padding
  const yDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [0, 100];

    const prices = chartData.map((d) => d.price);
    const min = Math.min(...prices, avgPrice);
    const max = Math.max(...prices, avgPrice);
    const range = max - min || 1;
    const padding = range * 0.1;

    return [
      Math.max(0, Math.floor((min - padding) * 100) / 100),
      Math.ceil((max + padding) * 100) / 100,
    ];
  }, [chartData, avgPrice]);

  // Determine tick count based on data length for readability
  const xTickInterval = useMemo(() => {
    if (chartData.length <= 10) return 0;
    if (chartData.length <= 30) return Math.floor(chartData.length / 5);
    if (chartData.length <= 90) return Math.floor(chartData.length / 6);
    return Math.floor(chartData.length / 5);
  }, [chartData]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="mt-3 pt-3 border-t border-warmBg-tertiary">
      {/* Period Selector */}
      <div className="flex gap-1.5 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`
              flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${
                period === p.key
                  ? 'bg-warmData-investment bg-opacity-20 text-warmData-investment'
                  : 'bg-warmBg-tertiary text-warmText-tertiary hover:text-warmText-secondary'
              }
            `}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-warmText-tertiary animate-spin" />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="text-center py-6">
          <p className="text-xs text-warmData-expense">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && chartData.length < 2 && (
        <div className="text-center py-6 px-2">
          <p className="text-xs text-warmText-tertiary">
            Storico in costruzione &mdash; i dati si accumulano giorno per giorno
          </p>
        </div>
      )}

      {/* Chart */}
      {!isLoading && !error && chartData.length >= 2 && (
        <div className="w-full" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`areaGradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor={COLORS.income} stopOpacity={0.4} />
                  <stop offset={gradientOffset} stopColor={COLORS.income} stopOpacity={0.1} />
                  <stop offset={gradientOffset} stopColor={COLORS.expense} stopOpacity={0.1} />
                  <stop offset={1} stopColor={COLORS.expense} stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id={`lineGradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor={COLORS.income} stopOpacity={1} />
                  <stop offset={gradientOffset} stopColor={COLORS.income} stopOpacity={1} />
                  <stop offset={gradientOffset} stopColor={COLORS.expense} stopOpacity={1} />
                  <stop offset={1} stopColor={COLORS.expense} stopOpacity={1} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={COLORS.gridStroke}
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fill: COLORS.axisText, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={xTickInterval}
                minTickGap={30}
              />

              <YAxis
                domain={yDomain}
                tick={{ fill: COLORS.axisText, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toFixed(0)}
                width={45}
              />

              <Tooltip
                content={<CustomTooltip avgPrice={avgPrice} />}
                cursor={{
                  stroke: COLORS.investment,
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />

              <ReferenceLine
                y={avgPrice}
                stroke={COLORS.investment}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `PMC ${formatPrice(avgPrice)}`,
                  position: 'insideTopRight',
                  fill: COLORS.investment,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />

              <Area
                type="monotone"
                dataKey="price"
                stroke={`url(#lineGradient-${symbol})`}
                strokeWidth={2}
                fill={`url(#areaGradient-${symbol})`}
                activeDot={{
                  r: 4,
                  fill: COLORS.investment,
                  stroke: COLORS.tooltipBg,
                  strokeWidth: 2,
                }}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
