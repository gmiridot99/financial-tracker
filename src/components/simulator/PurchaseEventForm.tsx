'use client';

import { useState, useEffect } from 'react';
import { X, Home, Car, TrendingUp } from 'lucide-react';
import { SimulationEvent } from '@/lib/simulator/types';
import { calculateMortgagePayment } from '@/lib/simulator/calculations';

interface PurchaseEventFormProps {
  event?: SimulationEvent;
  maxYear: number;
  inflationRate: number;
  onSave: (event: SimulationEvent) => void;
  onCancel: () => void;
}

export default function PurchaseEventForm({
  event,
  maxYear,
  inflationRate,
  onSave,
  onCancel,
}: PurchaseEventFormProps) {
  const [formData, setFormData] = useState<SimulationEvent>(
    event || {
      year: 1,
      type: 'purchase',
      assetName: '',
      purchasePrice: 300000,
      downPayment: 50000,
      debtAmount: 250000,
      debtDuration: 30,
      debtInterestRate: 3,
      assetAppreciationRate: 2,
    }
  );

  const [monthlyPayment, setMonthlyPayment] = useState(0);

  // Calculate monthly payment
  useEffect(() => {
    if (
      formData.debtAmount &&
      formData.debtDuration &&
      formData.debtInterestRate !== undefined
    ) {
      const payment = calculateMortgagePayment(
        formData.debtAmount,
        formData.debtInterestRate,
        formData.debtDuration * 12
      );
      setMonthlyPayment(payment);
    }
  }, [formData.debtAmount, formData.debtDuration, formData.debtInterestRate]);

  // Auto-calculate debt amount
  const updateDebtAmount = () => {
    if (formData.purchasePrice && formData.downPayment) {
      setFormData({
        ...formData,
        debtAmount: formData.purchasePrice - formData.downPayment,
      });
    }
  };

  useEffect(updateDebtAmount, [formData.purchasePrice, formData.downPayment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const setAppreciationToInflation = () => {
    setFormData({
      ...formData,
      assetAppreciationRate: inflationRate,
    });
  };

  const quickPreset = (type: 'house' | 'car') => {
    if (type === 'house') {
      setFormData({
        ...formData,
        assetName: 'Casa',
        purchasePrice: 300000,
        downPayment: 60000,
        debtAmount: 240000,
        debtDuration: 30,
        debtInterestRate: 3,
        assetAppreciationRate: 2,
      });
    } else {
      setFormData({
        ...formData,
        assetName: 'Auto',
        purchasePrice: 30000,
        downPayment: 5000,
        debtAmount: 25000,
        debtDuration: 5,
        debtInterestRate: 4,
        assetAppreciationRate: -10, // Depreciation
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {event ? 'Modifica Acquisto' : '🏠 Nuovo Acquisto Asset'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Quick Presets */}
        {!event && (
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <div className="text-sm font-medium text-slate-700 mb-3">
              Template Rapidi:
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => quickPreset('house')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 rounded-lg text-sm transition-colors"
              >
                <Home className="w-4 h-4 text-blue-600" />
                Casa (€300k, 30 anni)
              </button>
              <button
                type="button"
                onClick={() => quickPreset('car')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 rounded-lg text-sm transition-colors"
              >
                <Car className="w-4 h-4 text-blue-600" />
                Auto (€30k, 5 anni)
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Anno Acquisto
              </label>
              <input
                type="number"
                min="1"
                max={maxYear}
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nome Asset
              </label>
              <input
                type="text"
                placeholder="es. Casa Milano, Auto Tesla"
                value={formData.assetName}
                onChange={(e) =>
                  setFormData({ ...formData, assetName: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Purchase Details */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">
              Dettagli Acquisto
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prezzo Acquisto (€)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.purchasePrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purchasePrice: Number(e.target.value),
                      })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Anticipo (€)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.downPayment}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        downPayment: Number(e.target.value),
                      })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Debt Details */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">
              Finanziamento
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Importo Debito (€)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    €
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.debtAmount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        debtAmount: Number(e.target.value),
                      })
                    }
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                    required
                    readOnly
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Auto-calcolato (prezzo - anticipo)
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Durata (anni)
                </label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={formData.debtDuration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      debtDuration: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tasso (% annuo)
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  value={formData.debtInterestRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      debtInterestRate: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Monthly Payment Preview */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    Rata Mensile (ammortamento francese)
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Rata costante per {formData.debtDuration} anni
                  </div>
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  €{monthlyPayment.toLocaleString('it-IT', {
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Asset Appreciation */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Rivalutazione Asset
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tasso Rivalutazione (% annuo)
                </label>
                <input
                  type="number"
                  min="-50"
                  max="50"
                  step="0.1"
                  value={formData.assetAppreciationRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      assetAppreciationRate: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <div className="text-xs text-slate-500 mt-1">
                  Usa valori negativi per deprezzamento (es. -10% per auto)
                </div>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={setAppreciationToInflation}
                  className="px-4 py-2 bg-warmBg-tertiary hover:bg-warmBg-hover text-warmText-secondary rounded-lg text-sm font-medium transition-colors border border-warmText-muted"
                >
                  = Inflazione ({inflationRate}%)
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              {event ? 'Salva Modifiche' : 'Aggiungi Acquisto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
