'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Phase } from '@/lib/simulator/types';

interface PhaseFormProps {
  phase?: Phase;
  maxYear: number;
  onSave: (phase: Phase) => void;
  onCancel: () => void;
}

export default function PhaseForm({
  phase,
  maxYear,
  onSave,
  onCancel,
}: PhaseFormProps) {
  const [formData, setFormData] = useState<Phase>(
    phase || {
      startYear: 1,
      endYear: maxYear,
      monthlyIncome: 3000,
      monthlyExpenses: 2000,
      allocationInvestments: 60,
      allocationSavings: 40,
      investmentReturnRate: 7,
      savingsReturnRate: 1,
    }
  );

  const [errors, setErrors] = useState<string[]>([]);

  // Validate allocation
  useEffect(() => {
    const total = formData.allocationInvestments + formData.allocationSavings;
    if (Math.abs(total - 100) > 0.01) {
      setErrors([
        `L'allocazione deve sommare a 100% (attualmente ${total.toFixed(1)}%)`,
      ]);
    } else if (formData.endYear < formData.startYear) {
      setErrors(['L\'anno finale deve essere >= anno iniziale']);
    } else {
      setErrors([]);
    }
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length === 0) {
      onSave(formData);
    }
  };

  const handleAllocationChange = (field: 'investments' | 'savings', value: number) => {
    if (field === 'investments') {
      setFormData({
        ...formData,
        allocationInvestments: value,
        allocationSavings: 100 - value,
      });
    } else {
      setFormData({
        ...formData,
        allocationSavings: value,
        allocationInvestments: 100 - value,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {phase ? 'Modifica Fase' : 'Nuova Fase Temporale'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Display */}
        {errors.length > 0 && (
          <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-semibold text-red-900 mb-2">
              Errori di Validazione:
            </h4>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Time Range */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">
              Periodo Temporale
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Anno Iniziale
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxYear}
                  value={formData.startYear}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      startYear: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Anno Finale
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxYear}
                  value={formData.endYear}
                  onChange={(e) =>
                    setFormData({ ...formData, endYear: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Cash Flow */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Cash Flow Mensile</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Entrate (€/mese)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.monthlyIncome}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlyIncome: Number(e.target.value),
                      })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Uscite (€/mese)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.monthlyExpenses}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlyExpenses: Number(e.target.value),
                      })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Risparmio mensile: €
              {(formData.monthlyIncome - formData.monthlyExpenses).toLocaleString()}
            </div>
          </div>

          {/* Allocation */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">
              Allocazione Risparmio
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Investments
                  </label>
                  <span className="text-sm font-semibold text-blue-600">
                    {formData.allocationInvestments.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={formData.allocationInvestments}
                  onChange={(e) =>
                    handleAllocationChange('investments', Number(e.target.value))
                  }
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Savings
                  </label>
                  <span className="text-sm font-semibold text-green-600">
                    {formData.allocationSavings.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={formData.allocationSavings}
                  onChange={(e) =>
                    handleAllocationChange('savings', Number(e.target.value))
                  }
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
              </div>
            </div>
          </div>

          {/* Returns */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">
              Rendimenti Annui (%)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Investments (% annuo)
                </label>
                <input
                  type="number"
                  min="-20"
                  max="30"
                  step="0.1"
                  value={formData.investmentReturnRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      investmentReturnRate: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Savings (% annuo)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={formData.savingsReturnRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      savingsReturnRate: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={errors.length > 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors font-medium"
            >
              {phase ? 'Salva Modifiche' : 'Aggiungi Fase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
