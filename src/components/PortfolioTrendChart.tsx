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

interface PortfolioTrendChartProps {
  userId: string;
  savingsTotal: number;
  investmentsTotal: number;
}

interface ChartDataPoint {
  label: string;
  savings: number;
  investments: number;
}

// ── Constants ────────────────────────────────────────────────────────

const MONTH_ABBREVIATIONS = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];

const SAVINGS_COLOR = '#38BDF8';
const INVESTMENTS_COLOR = '#A78BFA';

// ── Tooltip ──────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function formatEur(value: number): string {
  return value.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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
          <span className="text-xs text-warmText-tertiary">{entry.name}</span>
          <span className="text-xs font-semibold text-warmText-primary ml-auto pl-3 tabular-nums">
            {formatEur(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

export default function PortfolioTrendChart({
  userId,
  savingsTotal,
  investmentsTotal,
}: PortfolioTrendChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data, error } = await supabase
        .from('wealth_snapshots')
        .select('year, month, savings_balance, investments_balance')
        .eq('user_id', userId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (error || !data || data.length === 0) {
        setChartData([{ label: 'Oggi', savings: savingsTotal, investments: investmentsTotal }]);
        setLoading(false);
        return;
      }

      const points: ChartDataPoint[] = data.map((s) => ({
        label: `${MONTH_ABBREVIATIONS[s.month - 1]} ${String(s.year).slice(2)}`,
        savings: Math.round(Number(s.savings_balance) * 100) / 100,
        investments: Math.round(Number(s.investments_balance) * 100) / 100,
      }));

      points.push({
        label: 'Oggi',
        savings: Math.round(savingsTotal * 100) / 100,
        investments: Math.round(investmentsTotal * 100) / 100,
      });

      setChartData(points);
      setLoading(false);
    }

    fetchData();
  }, [userId, savingsTotal, investmentsTotal]);

  if (loading) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-5 mb-4 animate-cardEnter">
        <ChartHeader />
        <div className="h-[200px] rounded-2xl bg-warmBg-tertiary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-5 mb-4 animate-cardEnter">
      <ChartHeader />
      <div className="h-[200px] sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
          >
            <defs>
              <linearGradient id="gradTrendSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SAVINGS_COLOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={SAVINGS_COLOR} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradTrendInvestments" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INVESTMENTS_COLOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={INVESTMENTS_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke="#1A1E26" vertical={false} />

            <XAxis
              dataKey="label"
              stroke="#5A6474"
              tick={{ fontSize: 10, fill: '#5A6474' }}
              tickLine={false}
              axisLine={{ stroke: '#1A1E26' }}
              dy={8}
            />
            <YAxis
              stroke="#5A6474"
              tick={{ fontSize: 10, fill: '#5A6474' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 0 })}k`
              }
              width={44}
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
              wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
              formatter={(value: string) => (
                <span style={{ color: '#8B95A5', fontSize: '11px', marginLeft: '3px' }}>
                  {value}
                </span>
              )}
            />

            <Area
              type="monotone"
              dataKey="savings"
              name="Risparmi"
              stroke={SAVINGS_COLOR}
              fill="url(#gradTrendSavings)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: SAVINGS_COLOR, stroke: '#12151A', strokeWidth: 2 }}
              animationDuration={1000}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="investments"
              name="Investimenti"
              stroke={INVESTMENTS_COLOR}
              fill="url(#gradTrendInvestments)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: INVESTMENTS_COLOR, stroke: '#12151A', strokeWidth: 2 }}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartHeader() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex gap-0.5">
        <div className="w-1 h-5 rounded-full bg-warmData-savings" />
        <div className="w-1 h-5 rounded-full bg-warmData-investment" />
      </div>
      <h3 className="text-base font-semibold text-warmText-primary">
        Andamento Patrimonio
      </h3>
    </div>
  );
}
