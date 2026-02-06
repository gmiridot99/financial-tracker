'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Calendar } from 'lucide-react';
import { Phase } from '@/lib/simulator/types';
import PhaseForm from './PhaseForm';

interface PhasesListProps {
  phases: Phase[];
  maxYear: number;
  onChange: (phases: Phase[]) => void;
}

export default function PhasesList({ phases, maxYear, onChange }: PhasesListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleAdd = (phase: Phase) => {
    onChange([...phases, phase]);
    setShowForm(false);
  };

  const handleEdit = (phase: Phase) => {
    if (editIndex !== null) {
      const updated = [...phases];
      updated[editIndex] = phase;
      onChange(updated);
      setEditIndex(null);
    }
  };

  const handleDelete = (index: number) => {
    if (confirm('Vuoi eliminare questa fase?')) {
      onChange(phases.filter((_, i) => i !== index));
    }
  };

  const handleStartEdit = (index: number) => {
    setEditIndex(index);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditIndex(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Fasi Temporali
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Aggiungi Fase
        </button>
      </div>

      {phases.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-2">Nessuna fase definita</p>
          <p className="text-sm text-slate-500 mb-4">
            Aggiungi almeno una fase temporale per definire entrate, uscite e rendimenti
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crea Prima Fase
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, index) => (
            <div
              key={index}
              className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                      Fase {index + 1}
                    </div>
                    <div className="text-sm font-medium text-slate-600">
                      Anni {phase.startYear} - {phase.endYear} (
                      {phase.endYear - phase.startYear + 1} anni)
                    </div>
                  </div>

                  {/* Cash Flow */}
                  <div className="grid md:grid-cols-2 gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm text-slate-700">
                        Entrate:{' '}
                        <span className="font-semibold text-green-600">
                          €{phase.monthlyIncome.toLocaleString()}/mese
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-sm text-slate-700">
                        Uscite:{' '}
                        <span className="font-semibold text-red-600">
                          €{phase.monthlyExpenses.toLocaleString()}/mese
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Allocation */}
                  <div className="mb-3">
                    <div className="text-xs text-slate-600 mb-1">Allocazione:</div>
                    <div className="flex gap-2 h-2">
                      <div
                        className="bg-blue-500 rounded-full"
                        style={{ width: `${phase.allocationInvestments}%` }}
                        title={`Investments: ${phase.allocationInvestments}%`}
                      />
                      <div
                        className="bg-green-500 rounded-full"
                        style={{ width: `${phase.allocationSavings}%` }}
                        title={`Savings: ${phase.allocationSavings}%`}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>{phase.allocationInvestments}% Investments</span>
                      <span>{phase.allocationSavings}% Savings</span>
                    </div>
                  </div>

                  {/* Returns */}
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="text-slate-600">Rendimenti:</div>
                      <span className="font-semibold text-blue-600">
                        {phase.investmentReturnRate}% Inv
                      </span>
                      <span className="text-slate-400">/</span>
                      <span className="font-semibold text-green-600">
                        {phase.savingsReturnRate}% Sav
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleStartEdit(index)}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifica"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <PhaseForm
          phase={editIndex !== null ? phases[editIndex] : undefined}
          maxYear={maxYear}
          onSave={editIndex !== null ? handleEdit : handleAdd}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
