'use client';

import { TrendingDown, TrendingUp, PiggyBank, Wallet } from 'lucide-react';

interface MonthlyFlowChartProps {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
}

export default function MonthlyFlowChart({
  totalIncome,
  totalExpenses,
  totalInvestments
}: MonthlyFlowChartProps) {
  const savings = totalIncome - totalExpenses - totalInvestments;
  const maxValue = totalIncome || 1;

  // Calculate percentages
  const expensesPercent = (totalExpenses / maxValue) * 100;
  const investmentsPercent = (totalInvestments / maxValue) * 100;
  const savingsPercent = (savings / maxValue) * 100;

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-5">
      <h3 className="text-sm font-medium text-warmText-tertiary mb-4">
        Flusso Mensile
      </h3>

      {/* Waterfall Flow */}
      <div className="space-y-3">
        {/* Entrate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-warmData-income bg-opacity-10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-warmData-income" />
              </div>
              <span className="text-sm font-medium text-warmText-secondary">Entrate</span>
            </div>
            <span className="text-base font-bold text-warmData-income">
              +€{totalIncome.toFixed(2)}
            </span>
          </div>
          <div className="h-2 bg-warmData-income rounded-full" style={{ width: '100%' }} />
        </div>

        {/* Spese */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-warmData-expense bg-opacity-10 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-warmData-expense" />
              </div>
              <span className="text-sm font-medium text-warmText-secondary">Spese</span>
            </div>
            <span className="text-base font-bold text-warmData-expense">
              -€{totalExpenses.toFixed(2)}
            </span>
          </div>
          <div className="h-2 bg-warmData-expense rounded-full" style={{ width: `${expensesPercent}%` }} />
        </div>

        {/* Investimenti */}
        {totalInvestments > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-warmData-investment bg-opacity-10 rounded-lg flex items-center justify-center">
                  <PiggyBank className="w-4 h-4 text-warmData-investment" />
                </div>
                <span className="text-sm font-medium text-warmText-secondary">Investimenti</span>
              </div>
              <span className="text-base font-bold text-warmData-investment">
                -€{totalInvestments.toFixed(2)}
              </span>
            </div>
            <div className="h-2 bg-warmData-investment rounded-full" style={{ width: `${investmentsPercent}%` }} />
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-warmBg-tertiary my-2" />

        {/* Risparmi/Cash Rimanente */}
        <div className="bg-warmBg-primary rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-warmData-savings bg-opacity-10 rounded-lg flex items-center justify-center">
                <Wallet className="w-4 h-4 text-warmData-savings" />
              </div>
              <span className="text-sm font-semibold text-warmText-primary">Cash Rimanente</span>
            </div>
            <span className={`text-lg font-bold ${savings >= 0 ? 'text-warmData-savings' : 'text-warmData-expense'}`}>
              {savings >= 0 ? '+' : ''}€{savings.toFixed(2)}
            </span>
          </div>
          {savings > 0 && (
            <div className="mt-2 h-2 bg-warmData-savings rounded-full" style={{ width: `${Math.min(savingsPercent, 100)}%` }} />
          )}
        </div>
      </div>

      {/* Formula */}
      <div className="mt-4 pt-4 border-t border-warmBg-tertiary">
        <p className="text-xs text-warmText-disabled text-center">
          Entrate ({totalIncome.toFixed(0)}) - Spese ({totalExpenses.toFixed(0)}) - Investimenti ({totalInvestments.toFixed(0)}) = Cash ({savings.toFixed(0)})
        </p>
      </div>
    </div>
  );
}
