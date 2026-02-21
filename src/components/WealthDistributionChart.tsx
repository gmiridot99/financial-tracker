'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// ── Types ────────────────────────────────────────────────────────────

export interface AssetSlice {
  name: string;
  value: number;
}

export interface AccountSlice {
  name: string;
  value: number;
}

export type DistributionMode = 'per-asset' | 'per-conto';

interface WealthDistributionChartProps {
  mode: DistributionMode;
  assetData: AssetSlice[];
  accountData: AccountSlice[];
  title?: string;
}

// ── Colors ───────────────────────────────────────────────────────────

const SLICE_COLORS = [
  '#3B82F6', // blue
  '#34D399', // green
  '#A78BFA', // purple
  '#38BDF8', // sky
  '#F87171', // red
  '#FBBF24', // amber
  '#818CF8', // indigo
  '#2DD4BF', // teal
  '#FB923C', // orange
  '#E879F9', // fuchsia
  '#5A6474', // gray (fallback)
];

// ── Tooltip ──────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { name: string; value: number } }>;
}

function formatEur(value: number): string {
  return value.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  return (
    <div className="bg-warmBg-tertiary border border-warmText-muted rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-warmText-primary mb-0.5">{entry.payload.name}</p>
      <p className="text-sm font-bold text-warmText-primary">{formatEur(entry.value)}</p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

export default function WealthDistributionChart({
  mode,
  assetData,
  accountData,
  title = 'Distribuzione Patrimonio',
}: WealthDistributionChartProps) {
  const data = mode === 'per-asset' ? assetData : accountData;

  // Filter out zero/negative values and sort descending
  const filtered = data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  if (filtered.length === 0) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-warmText-primary mb-3">
          {title}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="w-10 h-10 rounded-xl bg-warmAccent-primary bg-opacity-10 flex items-center justify-center">
            <svg className="w-5 h-5 text-warmAccent-primary opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
          </div>
          <p className="text-xs text-warmText-tertiary text-center">
            {mode === 'per-asset'
              ? 'Aggiungi asset per vedere la distribuzione'
              : 'Aggiungi conti per vedere la distribuzione'}
          </p>
        </div>
      </div>
    );
  }

  const total = filtered.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-warmText-primary mb-3">
        Distribuzione Patrimonio
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            animationDuration={800}
            animationEasing="ease-out"
          >
            {filtered.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                stroke="#0B0D11"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {filtered.map((entry, index) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={entry.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
                />
                <span className="text-warmText-secondary truncate">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-warmText-primary font-semibold">{formatEur(entry.value)}</span>
                <span className="text-warmText-tertiary w-12 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
