'use client';

import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Target, Calendar } from 'lucide-react';

export interface AnnualInsightsData {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
  avgSavingsRate: number; // 0-100
  bestMonth: { label: string; net: number };
  worstMonth: { label: string; net: number };
}

interface AnnualInsightsProps {
  data: AnnualInsightsData;
  year: number;
}

export default function AnnualInsights({ data, year }: AnnualInsightsProps) {
  const cards = [
    {
      title: 'Totale Entrate',
      value: `€${data.totalIncome.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-warmData-income',
      bgColor: 'bg-warmData-income/10',
    },
    {
      title: 'Totale Spese',
      value: `€${data.totalExpenses.toFixed(2)}`,
      icon: TrendingDown,
      color: 'text-warmData-expense',
      bgColor: 'bg-warmData-expense/10',
    },
    {
      title: 'Totale Investimenti',
      value: `€${data.totalInvestments.toFixed(2)}`,
      icon: Target,
      color: 'text-warmData-investment',
      bgColor: 'bg-warmData-investment/10',
    },
    {
      title: 'Tasso di Risparmio Medio',
      value: `${data.avgSavingsRate.toFixed(1)}%`,
      icon: PiggyBank,
      color: 'text-warmData-savings',
      bgColor: 'bg-warmData-savings/10',
    },
    {
      title: 'Mese Migliore',
      value: data.bestMonth.label,
      subtitle: `+€${data.bestMonth.net.toFixed(2)}`,
      icon: Calendar,
      color: 'text-warmData-income',
      bgColor: 'bg-warmData-income/10',
    },
    {
      title: 'Mese Peggiore',
      value: data.worstMonth.label,
      subtitle: data.worstMonth.net >= 0 ? `+€${data.worstMonth.net.toFixed(2)}` : `€${data.worstMonth.net.toFixed(2)}`,
      icon: Calendar,
      color: 'text-warmData-expense',
      bgColor: 'bg-warmData-expense/10',
    },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-warmText-primary mb-4 px-1">
        Riepilogo {year}
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-warmBg-secondary rounded-2xl p-4 border border-warmText-muted/20"
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-xl ${card.bgColor}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="text-xs text-warmText-tertiary mb-1">
                {card.title}
              </div>
              <div className="text-lg font-semibold text-warmText-primary">
                {card.value}
              </div>
              {card.subtitle && (
                <div className="text-xs text-warmText-tertiary mt-1">
                  {card.subtitle}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
