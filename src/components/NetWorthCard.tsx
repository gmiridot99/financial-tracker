'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, Droplets } from 'lucide-react';
import CountUp from '@/components/CountUp';
import { formatCurrency } from '@/hooks/useInvestmentAccounts';
import type { AccountSlice } from '@/components/WealthDistributionChart';

// ── Constants ───────────────────────────────────────────────────────

const DONUT_COLORS = [
  '#38BDF8', '#A78BFA', '#34D399', '#F59E0B',
  '#F472B6', '#2DD4BF', '#FB923C', '#818CF8',
];

// ── Props ───────────────────────────────────────────────────────────

interface NetWorthCardProps {
  savingsTotal: number;
  totalCashBalance: number;
  totalMarketValue: number | null;
  totalCostBasis: number;
  pricesLoading: boolean;
  accountSlices: AccountSlice[];
}

// ── Donut Tooltip ───────────────────────────────────────────────────

interface DonutTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { name: string; value: number } }>;
}

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const formatted = entry.value.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return (
    <div className="bg-warmBg-tertiary border border-warmText-muted rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-warmText-primary mb-0.5">{entry.payload.name}</p>
      <p className="text-sm font-bold text-warmText-primary">{formatted}</p>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

export default function NetWorthCard({
  savingsTotal,
  totalCashBalance,
  totalMarketValue,
  totalCostBasis,
  pricesLoading,
  accountSlices,
}: NetWorthCardProps) {
  const { liquidity, investments, total, isEstimate, liquidityPct, investmentsPct } = useMemo(() => {
    const liq = savingsTotal + totalCashBalance;
    const inv = totalMarketValue ?? totalCostBasis;
    const tot = liq + inv;
    const estimate = totalMarketValue === null && totalCostBasis > 0;

    let liqPct = 0;
    let invPct = 0;
    if (tot > 0) {
      liqPct = Math.round((liq / tot) * 100);
      invPct = 100 - liqPct;
    }

    return {
      liquidity: liq,
      investments: inv,
      total: tot,
      isEstimate: estimate,
      liquidityPct: liqPct,
      investmentsPct: invPct,
    };
  }, [savingsTotal, totalCashBalance, totalMarketValue, totalCostBasis]);

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-5 mb-4">
      <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-center">

        {/* ── LEFT: summary ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Total Net Worth */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-warmAccent-primary bg-opacity-10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-warmAccent-primary" />
            </div>
            <p className="text-xs font-medium text-warmText-tertiary uppercase tracking-wider">
              Patrimonio Netto
            </p>
          </div>
          <p className="text-3xl font-bold text-warmText-primary ml-10 mb-4">
            <CountUp end={total} />
          </p>

          {/* Proportional Bar */}
          {total > 0 && (
            <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
              {liquidityPct > 0 && (
                <div
                  className="bg-warmData-savings transition-all duration-500"
                  style={{ width: `${liquidityPct}%` }}
                />
              )}
              {investmentsPct > 0 && (
                <div
                  className="bg-warmData-investment transition-all duration-500"
                  style={{ width: `${investmentsPct}%` }}
                />
              )}
            </div>
          )}

          {/* Breakdown Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-warmData-savings bg-opacity-10 flex items-center justify-center">
                  <Droplets className="w-3.5 h-3.5 text-warmData-savings" />
                </div>
                <div>
                  <p className="text-sm font-medium text-warmText-primary">Liquidita</p>
                  <p className="text-xs text-warmText-tertiary">{liquidityPct}%</p>
                </div>
              </div>
              <p className="text-sm font-bold text-warmText-primary">{formatCurrency(liquidity)}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-warmData-investment bg-opacity-10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-warmData-investment" />
                </div>
                <div>
                  <p className="text-sm font-medium text-warmText-primary">
                    Investimenti
                    {isEstimate && !pricesLoading && (
                      <span className="text-xs text-warmText-tertiary ml-1">(stima)</span>
                    )}
                    {pricesLoading && (
                      <span className="text-xs text-warmText-tertiary ml-1 animate-pulse">...</span>
                    )}
                  </p>
                  <p className="text-xs text-warmText-tertiary">{investmentsPct}%</p>
                </div>
              </div>
              <p className="text-sm font-bold text-warmText-primary">{formatCurrency(investments)}</p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: donut (solo se ci sono dati) ───────────────── */}
        {accountSlices.length > 0 && (
          <div className="mt-5 lg:mt-0 lg:w-44 lg:flex-shrink-0">
            <div className="lg:hidden border-t border-warmBg-tertiary mb-4" />
            <p className="text-xs font-medium text-warmText-tertiary text-center mb-2">Per conto</p>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie
                  data={accountSlices}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {accountSlices.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      stroke="#0B0D11"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <RechartsTooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 space-y-1 max-h-[80px] overflow-y-auto">
              {accountSlices.map((slice, index) => (
                <div key={slice.name} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                  />
                  <span className="text-warmText-tertiary truncate flex-1">{slice.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
