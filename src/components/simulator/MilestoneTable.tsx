'use client';

import { Milestones, ExpenseRow } from '@/lib/simulator/types';
import { generateId } from '@/lib/simulator/calculations';
import { Trash2, Plus } from 'lucide-react';

interface MilestoneTableProps {
  milestones: Milestones;
  expenseRows: ExpenseRow[];
  startYear?: number;
  onMilestonesChange: (milestones: Milestones) => void;
  onExpenseRowsChange: (rows: ExpenseRow[]) => void;
}

const milestoneKeys = ['year1', 'year5', 'year10', 'year20', 'year30', 'year50'] as const;

const milestoneLabels: Record<(typeof milestoneKeys)[number], string> = {
  year1: 'Anno 1',
  year5: 'Anno 5',
  year10: 'Anno 10',
  year20: 'Anno 20',
  year30: 'Anno 30',
  year50: 'Anno 50',
};

const inputBase =
  'h-11 px-3 bg-warmBg-tertiary border border-transparent rounded-xl text-warmText-primary text-sm text-center hover:bg-warmBg-hover hover:border-warmText-muted transition-all';

const incomeFocus =
  'focus:border-warmData-income focus:ring-2 focus:ring-warmData-income focus:ring-opacity-20';

const expenseFocus =
  'focus:border-warmData-expense focus:ring-2 focus:ring-warmData-expense focus:ring-opacity-20';

export default function MilestoneTable({
  milestones,
  expenseRows,
  startYear,
  onMilestonesChange,
  onExpenseRowsChange,
}: MilestoneTableProps) {
  // --- Handlers ---

  const handleSalaryChange = (milestone: keyof Milestones, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    onMilestonesChange({
      ...milestones,
      [milestone]: { salary: isNaN(numValue) ? 0 : numValue },
    });
  };

  const handleExpenseAmountChange = (
    rowId: string,
    milestoneKey: string,
    value: string,
  ) => {
    const numValue = value === '' ? 0 : Number(value);
    onExpenseRowsChange(
      expenseRows.map((row) =>
        row.id === rowId
          ? { ...row, amounts: { ...row.amounts, [milestoneKey]: isNaN(numValue) ? 0 : numValue } }
          : row,
      ),
    );
  };

  const handleExpenseLabelChange = (rowId: string, label: string) => {
    onExpenseRowsChange(
      expenseRows.map((row) => (row.id === rowId ? { ...row, label } : row)),
    );
  };

  const addExpenseRow = () => {
    onExpenseRowsChange([
      ...expenseRows,
      {
        id: generateId(),
        label: '',
        amounts: { year1: 0, year5: 0, year10: 0, year20: 0, year30: 0, year50: 0 },
      },
    ]);
  };

  const removeExpenseRow = (id: string) => {
    onExpenseRowsChange(expenseRows.filter((row) => row.id !== id));
  };

  // --- Totals ---

  const totals = milestoneKeys.reduce(
    (acc, key) => {
      acc[key] = expenseRows.reduce(
        (sum, row) => sum + (row.amounts[key] || 0),
        0,
      );
      return acc;
    },
    {} as Record<string, number>,
  );

  // --- Render ---

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-6 border border-warmBg-tertiary">
      <h3 className="text-sm font-semibold text-warmText-primary mb-4 uppercase tracking-wider">
        Evoluzione Temporale
      </h3>

      {/* Header Row */}
      <div className="grid grid-cols-8 gap-3 mb-3">
        <div />
        {milestoneKeys.map((key) => {
          const internalYear = parseInt(key.replace('year', ''));
          let label: string;
          if (startYear) {
            if (internalYear === 1) {
              label = `${startYear} - Oggi`;
            } else {
              label = `${startYear + internalYear} - ${internalYear} anni`;
            }
          } else {
            label = milestoneLabels[key];
          }
          return (
            <div
              key={key}
              className="text-xs text-warmText-tertiary text-center font-medium leading-tight"
            >
              {label}
            </div>
          );
        })}
        <div />
      </div>

      {/* Salary Row */}
      <div className="grid grid-cols-8 gap-3 mb-3">
        <div className="flex items-center h-11 text-sm text-warmText-primary font-medium">
          Stipendio (&euro;/mese)
        </div>
        {milestoneKeys.map((key) => (
          <input
            key={key}
            type="number"
            value={milestones[key].salary || ''}
            onChange={(e) => handleSalaryChange(key, e.target.value)}
            className={`${inputBase} ${incomeFocus}`}
            placeholder="0"
            aria-label={`Stipendio ${milestoneLabels[key]}`}
          />
        ))}
        {/* Empty cell to align with delete column */}
        <div />
      </div>

      {/* Divider between salary and expenses */}
      <div className="border-t border-warmBg-tertiary my-4" />

      {/* Expense section header */}
      <div className="mb-3">
        <span className="text-xs font-semibold text-warmText-tertiary uppercase tracking-wider">
          Spese:
        </span>
      </div>

      {/* Expense Rows */}
      {expenseRows.map((row) => (
        <div
          key={row.id}
          className="group grid grid-cols-8 gap-3 mb-3 animate-cardEnter"
        >
          {/* Editable label */}
          <input
            type="text"
            value={row.label}
            onChange={(e) => handleExpenseLabelChange(row.id, e.target.value)}
            placeholder="Nome spesa..."
            className="h-11 px-2 bg-transparent border-b border-warmBg-tertiary rounded-none text-sm text-warmText-primary placeholder-warmText-disabled focus:border-warmText-secondary focus:outline-none transition-colors"
            aria-label="Nome della spesa"
          />
          {/* Amount inputs for each milestone */}
          {milestoneKeys.map((key) => (
            <input
              key={key}
              type="number"
              value={row.amounts[key] || ''}
              onChange={(e) =>
                handleExpenseAmountChange(row.id, key, e.target.value)
              }
              className={`${inputBase} ${expenseFocus}`}
              placeholder="0"
              aria-label={`${row.label || 'Spesa'} ${milestoneLabels[key]}`}
            />
          ))}
          {/* Delete button */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => removeExpenseRow(row.id)}
              className="p-2 rounded-xl text-warmText-disabled opacity-0 group-hover:opacity-100 hover:text-warmData-expense hover:bg-warmBg-tertiary active:scale-95 transition-all"
              aria-label={`Elimina spesa ${row.label}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}

      {/* Add expense button */}
      <div className="grid grid-cols-8 gap-3 mb-4">
        <button
          type="button"
          onClick={addExpenseRow}
          className="col-span-1 flex items-center gap-2 h-11 px-3 border border-dashed border-warmBg-hover text-warmText-tertiary text-sm rounded-xl hover:text-warmText-secondary hover:border-warmText-muted active:scale-95 transition-all"
          aria-label="Aggiungi una nuova spesa"
        >
          <Plus size={14} />
          <span className="truncate">Aggiungi spesa</span>
        </button>
        {/* Empty remaining columns */}
        <div className="col-span-6" />
      </div>

      {/* Divider before total */}
      <div className="border-t border-warmBg-tertiary my-4" />

      {/* Total Row */}
      <div className="grid grid-cols-8 gap-3">
        <div className="flex items-center h-11 text-sm font-semibold text-warmData-expense">
          Totale
        </div>
        {milestoneKeys.map((key) => (
          <div
            key={key}
            className="flex items-center justify-center h-11 text-sm font-semibold text-warmData-expense"
          >
            &euro;{(totals[key] ?? 0).toLocaleString()}
          </div>
        ))}
        <div />
      </div>

      {/* Info text */}
      <p className="mt-4 text-xs text-warmText-tertiary italic">
        Il simulatore interpola linearmente i valori tra le milestone
      </p>
    </div>
  );
}
