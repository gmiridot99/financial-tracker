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
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────

interface SavingsAccount {
  id: string;
  name: string;
  balance: number;
}

interface SavingsPerformanceChartProps {
  userId: string;
  currentTotal: number;
  accounts?: SavingsAccount[];
}

// Dynamic key: `a0`, `a1`, … keyed by account index
type ChartDataPoint = Record<string, number | string>;

interface Transfer {
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────

// Same palette as investment chart for visual consistency
const ACCOUNT_COLORS = [
  '#38BDF8', // sky (original savings color)
  '#A78BFA', // violet
  '#34D399', // green
  '#F59E0B', // amber
  '#F472B6', // pink
  '#2DD4BF', // teal
];

const MONTH_ABBREVIATIONS = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
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

function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7); // "2025-03"
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  return `${MONTH_ABBREVIATIONS[parseInt(month, 10) - 1]} ${year}`;
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

export default function SavingsPerformanceChart({
  userId,
  currentTotal,
  accounts = [],
}: SavingsPerformanceChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // ── Per-account reconstruction (from transfers) ───────────────
      if (accounts.length > 0) {
        const { data: transfers, error } = await supabase
          .from('savings_transfers')
          .select('from_account_id, to_account_id, amount, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }); // DESC for backward walk

        if (error) {
          console.error('Error loading transfers:', error);
          setChartData([]);
          setLoading(false);
          return;
        }

        const txns = (transfers ?? []) as Transfer[];

        // Reconstruct per-account balance history by walking backwards from current balance.
        // For each transfer (in reverse date order) we undo its effect to get the balance
        // as it was BEFORE that transfer.
        // This is exact as long as all balance changes go through savings_transfers.
        // Manual direct-edit adjustments create a discontinuity, but the "today" point
        // always uses the actual current balance so the chart is always accurate at Oggi.

        const allYearMonths = new Set<string>();
        const perAccountTimeline = new Map<string, Map<string, number>>();

        for (const account of accounts) {
          let balance = account.balance; // start from current balance (today)
          const timeline = new Map<string, number>();

          for (const tx of txns) {
            const ym = toYearMonth(tx.created_at);

            if (tx.to_account_id === account.id) {
              // Undo a deposit/receive: account had less before this transfer
              balance -= tx.amount;
            } else if (tx.from_account_id === account.id) {
              // Undo a withdrawal/send: account had more before this transfer
              balance += tx.amount;
            } else {
              continue;
            }

            allYearMonths.add(ym);
            // Going backwards: last write per month = oldest balance for that month
            timeline.set(ym, Math.round(balance * 100) / 100);
          }

          perAccountTimeline.set(account.id, timeline);
        }

        // Sort year-months chronologically
        const sortedYms = [...allYearMonths].sort();

        // Build chart data with forward-fill per account
        const lastKnown = new Map<string, number>();
        const points: ChartDataPoint[] = [];

        for (const ym of sortedYms) {
          const point: ChartDataPoint = { label: monthLabel(ym) };

          for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            const timeline = perAccountTimeline.get(acc.id);
            if (timeline?.has(ym)) {
              lastKnown.set(acc.id, timeline.get(ym)!);
            }
            point[`a${i}`] = lastKnown.get(acc.id) ?? 0;
          }

          points.push(point);
        }

        // "Oggi" with actual current balances
        const oggiPoint: ChartDataPoint = { label: 'Oggi' };
        for (let i = 0; i < accounts.length; i++) {
          oggiPoint[`a${i}`] = Math.round(accounts[i].balance * 100) / 100;
        }
        points.push(oggiPoint);

        // Trim leading all-zero rows
        const firstNonZeroIdx = points.findIndex(p =>
          accounts.some((_, i) => (p[`a${i}`] as number) > 0)
        );

        setChartData(firstNonZeroIdx >= 0 ? points.slice(firstNonZeroIdx) : points);
        setLoading(false);
        return;
      }

      // ── Fallback: aggregate from wealth_snapshots ─────────────────
      const { data, error } = await supabase
        .from('wealth_snapshots')
        .select('year, month, savings_balance')
        .eq('user_id', userId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (error || !data || data.length === 0) {
        setChartData([]);
        setLoading(false);
        return;
      }

      const points = data.map((s) => ({
        label: `${MONTH_ABBREVIATIONS[s.month - 1]} ${s.year}`,
        a0: s.savings_balance,
      }));
      points.push({ label: 'Oggi', a0: currentTotal });

      setChartData(points);
      setLoading(false);
    }

    fetchData();
  }, [userId, currentTotal, accounts]);

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
          <div className="w-12 h-12 rounded-2xl bg-warmData-savings bg-opacity-10 flex items-center justify-center">
            <svg className="w-6 h-6 text-warmData-savings opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <p className="text-sm text-warmText-tertiary text-center leading-relaxed">
            Inizia ad aggiungere risparmi<br />per vedere il tuo andamento
          </p>
        </div>
      </div>
    );
  }

  // ── Chart ────────────────────────────────────────────────────────

  // Use accounts if available; otherwise fall back to a single "Totale" series
  const renderAccounts =
    accounts.length > 0
      ? accounts
      : [{ id: 'total', name: 'Totale Risparmi', balance: currentTotal }];

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
              {renderAccounts.map((acc, i) => {
                const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length];
                return (
                  <linearGradient key={acc.id} id={`gradS${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="70%" stopColor={color} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
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

            {renderAccounts.map((acc, i) => {
              const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length];
              return (
                <Area
                  key={acc.id}
                  type="monotone"
                  dataKey={`a${i}`}
                  name={acc.name}
                  stroke={color}
                  fill={`url(#gradS${i})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: color, stroke: '#12151A', strokeWidth: 2 }}
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                  connectNulls
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function ChartHeader() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full bg-warmData-savings" />
      <h3 className="text-base font-semibold text-warmText-primary">
        Andamento Risparmi
      </h3>
    </div>
  );
}
