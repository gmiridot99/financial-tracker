'use client';

import { TrendingUp, TrendingDown, Trophy, AlertTriangle } from 'lucide-react';

export interface YearComparison {
  year: number;
  income: number;
  expenses: number;
  net: number;
  growthPercent: number;
  incomeGrowthPercent: number;
  expenseGrowthPercent: number;
}

export interface MultiYearInsights {
  bestYearIndex: number;
  worstYearIndex: number;
}

interface YearComparisonCardsProps {
  data: YearComparison[];
  insights: MultiYearInsights;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function GrowthBadge({ percent, label }: { percent: number; label: string }) {
  if (!isFinite(percent)) return null;

  const isPositive = percent > 0;
  const isZero = percent === 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  if (isZero) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5
        ${isPositive
          ? 'bg-warmData-income/15 text-warmData-income'
          : 'bg-warmData-expense/15 text-warmData-expense'
        }`}
      title={`${label}: ${isPositive ? '+' : ''}${percent.toFixed(1)}% rispetto anno precedente`}
    >
      <Icon className="w-3 h-3" />
      {isPositive ? '+' : ''}{percent.toFixed(1)}%
    </span>
  );
}

export default function YearComparisonCards({ data, insights }: YearComparisonCardsProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-warmText-primary mb-4 px-1">
        Confronto Anno per Anno
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((item, index) => {
          const isBestYear = index === insights.bestYearIndex && data.length > 1;
          const isWorstYear = index === insights.worstYearIndex && item.net < 0 && data.length > 1;

          return (
            <div
              key={item.year}
              className={`
                bg-warmBg-secondary rounded-3xl p-5 border transition-all duration-300
                hover:shadow-xl hover:-translate-y-0.5
                ${isBestYear
                  ? 'border-warmData-income/40 shadow-lg shadow-warmData-income/10'
                  : isWorstYear
                    ? 'border-warmData-expense/40 shadow-lg shadow-warmData-expense/10'
                    : 'border-warmText-muted/20'
                }
              `}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Year badge row */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-warmText-primary">
                  {item.year}
                </span>
                <div className="flex items-center gap-2">
                  {isBestYear && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-warmData-income/15 text-warmData-income rounded-full px-3 py-1"
                      title={`${formatCurrency(item.net)} netto in ${item.year}`}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Miglior Anno
                    </span>
                  )}
                  {isWorstYear && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-warmData-expense/15 text-warmData-expense rounded-full px-3 py-1"
                      title={`${formatCurrency(item.net)} netto in ${item.year}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Anno Difficile
                    </span>
                  )}
                </div>
              </div>

              {/* Income row */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-warmText-tertiary mb-0.5 uppercase tracking-wide">
                    Entrate
                  </p>
                  <p className="text-lg font-semibold text-warmData-income">
                    {formatCurrency(item.income)}
                  </p>
                </div>
                <GrowthBadge percent={item.incomeGrowthPercent} label="Entrate" />
              </div>

              {/* Expenses row */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-warmText-tertiary mb-0.5 uppercase tracking-wide">
                    Spese
                  </p>
                  <p className="text-lg font-semibold text-warmData-expense">
                    {formatCurrency(item.expenses)}
                  </p>
                </div>
                <GrowthBadge percent={item.expenseGrowthPercent} label="Spese" />
              </div>

              {/* Divider */}
              <div className="border-t border-warmText-muted/20 my-3" />

              {/* Net income row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-warmText-tertiary mb-0.5 uppercase tracking-wide">
                    Netto
                  </p>
                  <p className={`text-xl font-bold ${item.net >= 0 ? 'text-warmData-income' : 'text-warmData-expense'}`}>
                    {item.net >= 0 ? '+' : ''}{formatCurrency(item.net)}
                  </p>
                </div>
                <GrowthBadge percent={item.growthPercent} label="Netto" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
