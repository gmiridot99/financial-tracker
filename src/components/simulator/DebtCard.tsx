'use client';

import { DebtInput } from '@/lib/simulator/types';
import { displayYear } from '@/lib/dateUtils';
import { Home, Car, Edit2, Trash2, ArrowUpRight } from 'lucide-react';

interface DebtCardProps {
  debt: DebtInput;
  startYear?: number;
  onEdit: (debt: DebtInput) => void;
  onDelete: (id: string) => void;
}

export default function DebtCard({ debt, startYear, onEdit, onDelete }: DebtCardProps) {
  // Determine icon based on name or value
  const isRealEstate = debt.appreciationRate !== undefined && debt.appreciationRate > 0;
  const Icon = isRealEstate ? Home : Car;

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-5 border border-warmBg-tertiary hover:border-warmData-expense hover:border-opacity-30 transition-colors group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-warmData-expense bg-opacity-20 rounded-lg">
              <Icon className="w-5 h-5 text-warmData-expense" />
            </div>
            <div>
              <h4 className="font-semibold text-warmText-primary">{debt.name}</h4>
              <span className="text-xs text-warmText-tertiary">{displayYear(debt.year, startYear)}</span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-warmText-tertiary block mb-1">Valore</span>
              <div className="font-medium text-warmText-primary">
                €{debt.totalValue.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-warmText-tertiary block mb-1">Cash</span>
              <div className="font-medium text-warmText-primary">
                €{debt.cashPayment.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-warmText-tertiary block mb-1">Debito</span>
              <div className="font-medium text-warmData-expense">
                €{debt.debtAmount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Financing Info */}
          <div className="mt-3 text-sm text-warmText-secondary">
            Tasso {debt.interestRate}% • {debt.durationYears} anni
            {debt.appreciationRate && ` • Rivalutazione ${debt.appreciationRate}%/anno`}
          </div>

          {/* Sale Info */}
          {debt.sale && (
            <div className="mt-3 p-2 bg-warmData-income bg-opacity-10 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-warmData-income font-medium">
                <ArrowUpRight className="w-4 h-4" />
                Vendita pianificata: {displayYear(debt.sale.year, startYear)}
              </div>
              <div className="text-warmText-secondary mt-1">
                Prezzo: €{debt.sale.salePrice.toLocaleString()} •
                Surplus → {debt.sale.allocationInvestments}% Inv / {debt.sale.allocationSavings}% Sav
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
          <button
            onClick={() => onEdit(debt)}
            className="p-2 text-warmText-tertiary hover:text-warmData-expense hover:bg-warmData-expense hover:bg-opacity-10 rounded-lg transition-colors"
            title="Modifica"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(debt.id)}
            className="p-2 text-warmText-tertiary hover:text-warmData-expense hover:bg-warmData-expense hover:bg-opacity-10 rounded-lg transition-colors"
            title="Elimina"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
