'use client';

import { useEffect, useState } from 'react';

interface AllocationBarProps {
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  investments: number;
}

export default function AllocationBar({
  totalIncome,
  totalExpenses,
  savings,
  investments
}: AllocationBarProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, [totalIncome, totalExpenses, savings, investments]);

  const available = totalIncome - totalExpenses - savings - investments;
  const total = totalIncome || 1; // Avoid division by zero

  const expensePercentage = (totalExpenses / total) * 100;
  const investmentPercentage = (investments / total) * 100;
  const savingsPercentage = (savings / total) * 100;
  const availablePercentage = (available / total) * 100;

  return (
    <div className="bg-warmBg-secondary rounded-[20px] p-5">
      <h3 className="text-sm font-medium text-warmText-tertiary mb-4">
        Come stai usando i tuoi soldi
      </h3>

      {/* Allocation Bar */}
      <div className="h-8 rounded-2xl bg-warmBg-primary overflow-hidden flex mb-3">
        {expensePercentage > 0 && (
          <div
            className="bg-warmData-expense transition-all duration-700 ease-out"
            style={{ width: animated ? `${expensePercentage}%` : '0%' }}
          />
        )}
        {investmentPercentage > 0 && (
          <div
            className="bg-warmData-investment transition-all duration-700 ease-out"
            style={{ width: animated ? `${investmentPercentage}%` : '0%' }}
          />
        )}
        {savingsPercentage > 0 && (
          <div
            className="bg-warmData-savings transition-all duration-700 ease-out"
            style={{ width: animated ? `${savingsPercentage}%` : '0%' }}
          />
        )}
        {availablePercentage > 0 && (
          <div
            className="bg-warmBg-tertiary transition-all duration-700 ease-out"
            style={{ width: animated ? `${availablePercentage}%` : '0%' }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-warmData-expense" />
          <div className="flex-1">
            <div className="text-xs font-medium text-warmText-secondary">Spese</div>
            <div className="text-sm font-semibold text-warmText-primary">
              €{totalExpenses.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-warmData-investment" />
          <div className="flex-1">
            <div className="text-xs font-medium text-warmText-secondary">Investimenti</div>
            <div className="text-sm font-semibold text-warmText-primary">
              €{investments.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-warmData-savings" />
          <div className="flex-1">
            <div className="text-xs font-medium text-warmText-secondary">Risparmi</div>
            <div className="text-sm font-semibold text-warmText-primary">
              €{savings.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-warmBg-tertiary" />
          <div className="flex-1">
            <div className="text-xs font-medium text-warmText-secondary">Disponibile</div>
            <div className="text-sm font-semibold text-warmText-primary">
              €{available.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
