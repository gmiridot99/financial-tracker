'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { it } from 'date-fns/locale/it';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────

export interface AccountInfo {
  id: string;
  name: string;
  holdingsValue: number;
  cashBalance: number;
}

interface InvestmentPerformanceChartProps {
  userId: string;
  totalMarketValue: number | null;
  totalCashBalance: number;
  accounts?: AccountInfo[];
}

// Dynamic key: `a0`, `a1`, … keyed by account index
type ChartDataPoint = Record<string, number | string>;

interface InvestmentTransaction {
  investment_account_id: string;
  transaction_type: string;
  total_amount: number;
  transaction_date: string;
}

// ── Constants ────────────────────────────────────────────────────────

// One distinct warm-dark color per account (wraps if > 6 accounts)
const ACCOUNT_COLORS = [
  '#A78BFA', // violet
  '#60A5FA', // blue
  '#34D399', // green
  '#F59E0B', // amber
  '#F472B6', // pink
  '#2DD4BF', // teal
];

// ── Helpers ──────────────────────────────────────────────────────────

function formatEur(value: number): string {
  return value.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ── Custom Tooltip ───────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-warmBg-tertiary border border-warmText-muted rounded-2xl px-4 py-3 shadow-xl min-w-[180px]">
      <p className="text-xs font-medium text-warmText-secondary mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-warmText-tertiary truncate max-w-[100px]">{entry.name}</span>
          <span className="text-xs font-semibold text-warmText-primary ml-auto pl-2 tabular-nums">
            {formatEur(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function InvestmentPerformanceChart({
  userId,
  totalMarketValue,
  totalCashBalance,
  accounts = [],
}: InvestmentPerformanceChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true);

      const { data, error } = await supabase
        .from('investment_transactions')
        .select('investment_account_id, transaction_type, total_amount, transaction_date')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: true });

      if (error || !data || data.length === 0) {
        setChartData([]);
        setLoading(false);
        return;
      }

      const transactions = data as InvestmentTransaction[];

      // Build per-account cumulative cost basis timeline
      // accountId -> (dateStr -> cumulativeCostBasis)
      const timelines = new Map<string, Map<string, number>>();
      const runningTotals = new Map<string, number>(); // accountId -> current cumulative

      for (const tx of transactions) {
        const accId = tx.investment_account_id;
        if (!timelines.has(accId)) timelines.set(accId, new Map());

        const current = runningTotals.get(accId) ?? 0;
        const next =
          tx.transaction_type === 'buy'
            ? current + tx.total_amount
            : current - tx.total_amount;
        runningTotals.set(accId, next);
        timelines.get(accId)!.set(tx.transaction_date, Math.round(next * 100) / 100);
      }

      // All unique transaction dates, sorted ascending
      const allDates = [...new Set(transactions.map(t => t.transaction_date))].sort();

      // Build chart data with forward-fill per account
      const points: ChartDataPoint[] = [];
      const lastKnown = new Map<string, number>(); // accountId -> last seen cost basis

      for (const dateStr of allDates) {
        const d = new Date(dateStr);
        const point: ChartDataPoint = {
          label: format(d, 'dd MMM yy', { locale: it }),
        };

        for (let i = 0; i < accounts.length; i++) {
          const acc = accounts[i];
          const timeline = timelines.get(acc.id);
          if (timeline?.has(dateStr)) {
            lastKnown.set(acc.id, timeline.get(dateStr)!);
          }
          // Use last known value (forward-fill) or 0 if no transactions yet
          point[`a${i}`] = lastKnown.get(acc.id) ?? 0;
        }

        // Handle accounts we don't recognise yet (transactions from deleted/unknown accounts)
        // — simply skip them, they won't have a column

        points.push(point);
      }

      // "Oggi" point: use actual market value per account (holdingsValue + cashBalance)
      if (accounts.length > 0) {
        const oggiPoint: ChartDataPoint = { label: 'Oggi' };
        for (let i = 0; i < accounts.length; i++) {
          const acc = accounts[i];
          oggiPoint[`a${i}`] = Math.round((acc.holdingsValue + acc.cashBalance) * 100) / 100;
        }
        points.push(oggiPoint);
      } else {
        // Fallback: global market value
        const currentMarketValue =
          totalMarketValue !== null ? totalMarketValue + totalCashBalance : null;
        if (currentMarketValue !== null && points.length > 0) {
          points.push({ label: 'Oggi', a0: Math.round(currentMarketValue * 100) / 100 });
        }
      }

      setChartData(points);
      setLoading(false);
    }

    fetchTransactions();
  }, [userId, totalMarketValue, totalCashBalance, accounts]);

  // ── Loading skeleton ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-5 animate-cardEnter">
        <ChartHeader />
        <div className="h-[340px] flex flex-col gap-3 px-2">
          <div className="flex-1 rounded-2xl bg-warmBg-tertiary animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────

  if (chartData.length === 0) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-5 animate-cardEnter">
        <ChartHeader />
        <div className="h-[340px] flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-warmData-investment bg-opacity-10 flex items-center justify-center">
            <svg className="w-6 h-6 text-warmData-investment opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm text-warmText-tertiary text-center leading-relaxed">
            Inizia ad aggiungere investimenti<br />per vedere il tuo andamento
          </p>
        </div>
      </div>
    );
  }

  // ── Chart ────────────────────────────────────────────────────────

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-5 animate-cardEnter">
      <ChartHeader />

      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 12, right: 12, left: -8, bottom: 4 }}
          >
            <defs>
              {accounts.map((acc, i) => {
                const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length];
                return (
                  <linearGradient key={acc.id} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="70%" stopColor={color} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
              {/* Fallback gradient when no accounts prop yet */}
              {accounts.length === 0 && (
                <linearGradient id="grad0" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCOUNT_COLORS[0]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={ACCOUNT_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              )}
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke="#1A1E26" vertical={false} />

            <XAxis
              dataKey="label"
              stroke="#5A6474"
              tick={{ fontSize: 11, fill: '#5A6474' }}
              tickLine={false}
              axisLine={{ stroke: '#1A1E26' }}
              dy={8}
            />
            <YAxis
              stroke="#5A6474"
              tick={{ fontSize: 11, fill: '#5A6474' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                `${(value / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k`
              }
              width={48}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#5A6474', strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', paddingBottom: '12px' }}
              formatter={(value: string) => (
                <span style={{ color: '#8B95A5', fontSize: '12px', marginLeft: '4px' }}>
                  {value}
                </span>
              )}
            />

            {accounts.length > 0
              ? accounts.map((acc, i) => {
                  const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length];
                  return (
                    <Area
                      key={acc.id}
                      type="monotone"
                      dataKey={`a${i}`}
                      name={acc.name}
                      stroke={color}
                      fill={`url(#grad${i})`}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: color, stroke: '#12151A', strokeWidth: 2 }}
                      animationDuration={1200}
                      animationEasing="ease-in-out"
                      connectNulls
                    />
                  );
                })
              : (
                <Area
                  type="monotone"
                  dataKey="a0"
                  name="Portafoglio"
                  stroke={ACCOUNT_COLORS[0]}
                  fill="url(#grad0)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: ACCOUNT_COLORS[0], stroke: '#12151A', strokeWidth: 2 }}
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                />
              )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Small sub-components ─────────────────────────────────────────────

function ChartHeader() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full bg-warmData-investment" />
      <h3 className="text-base font-semibold text-warmText-primary">
        Andamento Investimenti
      </h3>
    </div>
  );
}
