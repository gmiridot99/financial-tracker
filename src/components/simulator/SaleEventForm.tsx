'use client';

import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { SimulationEvent } from '@/lib/simulator/types';

interface SaleEventFormProps {
  event?: SimulationEvent;
  maxYear: number;
  availableAssets: Array<{ id: string; name: string; purchaseYear: number }>;
  onSave: (event: SimulationEvent) => void;
  onCancel: () => void;
}

export default function SaleEventForm({
  event,
  maxYear,
  availableAssets,
  onSave,
  onCancel,
}: SaleEventFormProps) {
  const [formData, setFormData] = useState<SimulationEvent>(
    event || {
      year: 1,
      type: 'sale',
      saleAssetId: '',
      surplusAllocation: {
        investmentsPercent: 70,
        savingsPercent: 30,
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleAllocationChange = (field: 'investments' | 'savings', value: number) => {
    if (!formData.surplusAllocation) return;

    if (field === 'investments') {
      setFormData({
        ...formData,
        surplusAllocation: {
          investmentsPercent: value,
          savingsPercent: 100 - value,
        },
      });
    } else {
      setFormData({
        ...formData,
        surplusAllocation: {
          savingsPercent: value,
          investmentsPercent: 100 - value,
        },
      });
    }
  };

  const selectedAsset = availableAssets.find(
    (a) => a.id === formData.saleAssetId
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {event ? 'Modifica Vendita' : '💰 Nuova Vendita Asset'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Anno Vendita
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
                Asset da Vendere
              </label>
              <select
                value={formData.saleAssetId}
                onChange={(e) =>
                  setFormData({ ...formData, saleAssetId: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seleziona asset...</option>
                {availableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} (acquistato anno {asset.purchaseYear})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info Message */}
          {availableAssets.length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex gap-3">
                <div className="text-amber-600">⚠️</div>
                <div>
                  <div className="text-sm font-medium text-amber-900">
                    Nessun asset disponibile
                  </div>
                  <div className="text-sm text-amber-700 mt-1">
                    Aggiungi prima un evento di acquisto asset per poterlo vendere
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedAsset && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-2">
                Asset Selezionato
              </div>
              <div className="text-lg font-semibold text-blue-700">
                {selectedAsset.name}
              </div>
              <div className="text-sm text-blue-600 mt-1">
                Acquistato anno {selectedAsset.purchaseYear}
              </div>
            </div>
          )}

          {/* Surplus Allocation */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Riallocazione Surplus (Ricavo - Debito Residuo)
            </h3>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-4">
              <div className="text-sm text-slate-700 mb-1">
                Il ricavo della vendita verrà utilizzato per:
              </div>
              <div className="text-sm text-slate-600">
                1. Estinguere il debito eventuale collegato all'asset
              </div>
              <div className="text-sm text-slate-600">
                2. Il surplus verrà riallocato secondo le percentuali sotto
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Investments
                  </label>
                  <span className="text-sm font-semibold text-blue-600">
                    {formData.surplusAllocation?.investmentsPercent.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.surplusAllocation?.investmentsPercent || 70}
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
                    {formData.surplusAllocation?.savingsPercent.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.surplusAllocation?.savingsPercent || 30}
                  onChange={(e) =>
                    handleAllocationChange('savings', Number(e.target.value))
                  }
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
              </div>
            </div>

            {/* Allocation Bar */}
            <div className="mt-4">
              <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                <div
                  className="bg-blue-500 flex items-center justify-center text-white text-sm font-medium"
                  style={{
                    width: `${formData.surplusAllocation?.investmentsPercent || 70}%`,
                  }}
                >
                  {formData.surplusAllocation?.investmentsPercent}%
                </div>
                <div
                  className="bg-green-500 flex items-center justify-center text-white text-sm font-medium"
                  style={{
                    width: `${formData.surplusAllocation?.savingsPercent || 30}%`,
                  }}
                >
                  {formData.surplusAllocation?.savingsPercent}%
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-900 mb-2">
              Cosa succede alla vendita?
            </div>
            <div className="text-sm text-green-700 space-y-1">
              <div>
                1. Ricavo vendita = valore corrente asset (rivalutato)
              </div>
              <div>
                2. Estinzione debito residuo (se presente)
              </div>
              <div>
                3. Surplus = ricavo - debito residuo
              </div>
              <div>
                4. {formData.surplusAllocation?.investmentsPercent}% surplus →
                Investments
              </div>
              <div>
                5. {formData.surplusAllocation?.savingsPercent}% surplus →
                Savings
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
              disabled={availableAssets.length === 0 || !formData.saleAssetId}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg transition-colors font-medium"
            >
              {event ? 'Salva Modifiche' : 'Aggiungi Vendita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
