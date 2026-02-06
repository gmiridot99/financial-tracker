'use client';

import { useState } from 'react';
import { DebtInput } from '@/lib/simulator/types';
import DebtCard from './DebtCard';
import InlineDebtForm from './InlineDebtForm';
import { Home } from 'lucide-react';

interface DebtsListProps {
  debts: DebtInput[];
  maxYear: number;
  startYear?: number;
  onChange: (debts: DebtInput[]) => void;
}

export default function DebtsList({ debts, maxYear, startYear, onChange }: DebtsListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtInput | undefined>(undefined);

  const handleAdd = () => {
    setEditingDebt(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (debt: DebtInput) => {
    setEditingDebt(debt);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo debito?')) {
      onChange(debts.filter((d) => d.id !== id));
    }
  };

  const handleSave = (debt: DebtInput) => {
    if (editingDebt) {
      // Update existing
      onChange(debts.map((d) => (d.id === debt.id ? debt : d)));
    } else {
      // Add new
      onChange([...debts, debt]);
    }
    setIsFormOpen(false);
    setEditingDebt(undefined);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingDebt(undefined);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-warmText-primary mb-4 uppercase tracking-wider">
        Debiti / Acquisti
      </h3>

      <div className="space-y-3">
        {/* Existing debts */}
        {debts.map((debt) => (
          <DebtCard
            key={debt.id}
            debt={debt}
            startYear={startYear}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}

        {/* Inline form or add button */}
        {isFormOpen ? (
          <InlineDebtForm
            debt={editingDebt}
            maxYear={maxYear}
            startYear={startYear}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <button
            onClick={handleAdd}
            className="w-full h-[52px] bg-warmBg-tertiary rounded-2xl border border-dashed border-warmText-muted px-4 flex items-center gap-3 hover:border-warmData-expense hover:border-opacity-50 transition-colors group"
          >
            <Home className="w-5 h-5 text-warmData-expense" />
            <span className="text-sm text-warmText-disabled group-hover:text-warmText-secondary transition-colors">
              Aggiungi debito/acquisto...
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
