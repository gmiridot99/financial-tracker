'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────

export interface YearlyDataPoint {
  year: string;
  income: number;
  expenses: number;
  wealthInvestments: number;
  wealthSavings: number;
}

interface MultiYearTrendChartProps {
  data: YearlyDataPoint[];
}

// ── Helpers ────────────────────────────────────────────────────────────

const LINE_COLORS = {
  income: '#34D399',
  expenses: '#F87171',
  wealthInvestments: '#A78BFA',
  wealthSavings: '#38BDF8',
} as const;

function formatYAxisTick(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `\u20AC${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `\u20AC${(value / 1_000).toFixed(0)}k`;
  }
  return `\u20AC${value.toFixed(0)}`;
}

function formatTooltipValue(value: number): string {
  return value.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
}

// ── Custom Tooltip ─────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-warmBg-primary border border-warmText-muted/20 rounded-2xl px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-warmText-primary mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-warmText-tertiary">{entry.name}</span>
            <span className="font-semibold text-warmText-primary ml-auto">
              {formatTooltipValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────

export default function MultiYearTrendChart({ data }: MultiYearTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-warmBg-secondary rounded-3xl p-8 text-center">
        <p className="text-warmText-tertiary text-sm">
          Nessun dato disponibile per il grafico
        </p>
      </div>
    );
  }

  return (
    <div className="bg-warmBg-secondary rounded-3xl p-6">
      <h3 className="text-lg font-semibold text-warmText-primary mb-6">
        Andamento Multi-Anno
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(90, 100, 116, 0.15)"
            vertical={false}
          />
          <XAxis
            dataKey="year"
            stroke="#5A6474"
            style={{ fontSize: '12px', fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#5A6474"
            style={{ fontSize: '11px' }}
            tickFormatter={formatYAxisTick}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
            iconType="circle"
            iconSize={8}
          />

          {/* Income Line */}
          <Line
            type="monotone"
            dataKey="income"
            stroke={LINE_COLORS.income}
            strokeWidth={2.5}
            name="Entrate"
            dot={{ fill: LINE_COLORS.income, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#0B0D11' }}
          />

          {/* Expenses Line */}
          <Line
            type="monotone"
            dataKey="expenses"
            stroke={LINE_COLORS.expenses}
            strokeWidth={2.5}
            name="Spese"
            dot={{ fill: LINE_COLORS.expenses, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#0B0D11' }}
          />

          {/* Wealth Investments Line */}
          <Line
            type="monotone"
            dataKey="wealthInvestments"
            stroke={LINE_COLORS.wealthInvestments}
            strokeWidth={2.5}
            name="Investimenti"
            dot={{ fill: LINE_COLORS.wealthInvestments, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#0B0D11' }}
          />

          {/* Wealth Savings Line */}
          <Line
            type="monotone"
            dataKey="wealthSavings"
            stroke={LINE_COLORS.wealthSavings}
            strokeWidth={2.5}
            name="Risparmi"
            dot={{ fill: LINE_COLORS.wealthSavings, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#0B0D11' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
