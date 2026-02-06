'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, Home, DollarSign } from 'lucide-react';
import { SimulationEvent } from '@/lib/simulator/types';
import PurchaseEventForm from './PurchaseEventForm';
import SaleEventForm from './SaleEventForm';

interface EventsListProps {
  events: SimulationEvent[];
  maxYear: number;
  inflationRate: number;
  onChange: (events: SimulationEvent[]) => void;
}

export default function EventsList({
  events,
  maxYear,
  inflationRate,
  onChange,
}: EventsListProps) {
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'purchase' | 'sale'>('purchase');
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // Sort events by year
  const sortedEvents = [...events].sort((a, b) => a.year - b.year);

  // Get available assets for sale events (from purchase events)
  const availableAssets = events
    .filter((e) => e.type === 'purchase' && e.assetName)
    .map((e, index) => ({
      id: `asset-${index}`, // Use index as ID for now
      name: e.assetName || 'Unknown Asset',
      purchaseYear: e.year,
    }));

  const handleAdd = (event: SimulationEvent) => {
    onChange([...events, event]);
    setShowForm(false);
  };

  const handleEdit = (event: SimulationEvent) => {
    if (editIndex !== null) {
      const updated = [...events];
      updated[editIndex] = event;
      onChange(updated);
      setEditIndex(null);
      setShowForm(false);
    }
  };

  const handleDelete = (index: number) => {
    if (confirm('Vuoi eliminare questo evento?')) {
      onChange(events.filter((_, i) => i !== index));
    }
  };

  const handleStartAdd = (type: 'purchase' | 'sale') => {
    setFormType(type);
    setEditIndex(null);
    setShowForm(true);
  };

  const handleStartEdit = (index: number) => {
    setFormType(events[index].type);
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
          <Calendar className="w-5 h-5 text-purple-600" />
          Eventi
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleStartAdd('purchase')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Acquisto
          </button>
          <button
            onClick={() => handleStartAdd('sale')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Vendita
          </button>
        </div>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-2">Nessun evento definito</p>
          <p className="text-sm text-slate-500 mb-4">
            Aggiungi eventi per simulare acquisti (casa, auto) e vendite
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleStartAdd('purchase')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Home className="w-4 h-4" />
              Nuovo Acquisto
            </button>
            <button
              onClick={() => handleStartAdd('sale')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              Nuova Vendita
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((event, index) => {
            const originalIndex = events.indexOf(event);

            if (event.type === 'purchase') {
              return (
                <div
                  key={index}
                  className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 hover:border-blue-400 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                          <Home className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-blue-900">
                            Acquisto: {event.assetName}
                          </div>
                          <div className="text-sm text-blue-700">
                            Anno {event.year}
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-blue-700">Prezzo</div>
                          <div className="font-semibold text-blue-900">
                            €{event.purchasePrice?.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-blue-700">Anticipo</div>
                          <div className="font-semibold text-blue-900">
                            €{event.downPayment?.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-blue-700">Debito</div>
                          <div className="font-semibold text-blue-900">
                            €{event.debtAmount?.toLocaleString()} (
                            {event.debtDuration} anni @ {event.debtInterestRate}
                            %)
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-sm">
                        <span className="text-blue-700">Rivalutazione: </span>
                        <span className="font-semibold text-blue-900">
                          {event.assetAppreciationRate}% annuo
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleStartEdit(originalIndex)}
                        className="p-2 text-blue-700 hover:text-blue-900 hover:bg-blue-200 rounded-lg transition-colors"
                        title="Modifica"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(originalIndex)}
                        className="p-2 text-blue-700 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Sale event
              return (
                <div
                  key={index}
                  className="p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 hover:border-green-400 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-600 rounded-lg">
                          <DollarSign className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-green-900">
                            Vendita Asset
                          </div>
                          <div className="text-sm text-green-700">
                            Anno {event.year}
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="text-green-700">
                            Riallocazione surplus:{' '}
                          </span>
                          <span className="font-semibold text-green-900">
                            {event.surplusAllocation?.investmentsPercent}% Inv /{' '}
                            {event.surplusAllocation?.savingsPercent}% Sav
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleStartEdit(originalIndex)}
                        className="p-2 text-green-700 hover:text-green-900 hover:bg-green-200 rounded-lg transition-colors"
                        title="Modifica"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(originalIndex)}
                        className="p-2 text-green-700 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && formType === 'purchase' && (
        <PurchaseEventForm
          event={editIndex !== null ? events[editIndex] : undefined}
          maxYear={maxYear}
          inflationRate={inflationRate}
          onSave={editIndex !== null ? handleEdit : handleAdd}
          onCancel={handleCancel}
        />
      )}

      {showForm && formType === 'sale' && (
        <SaleEventForm
          event={editIndex !== null ? events[editIndex] : undefined}
          maxYear={maxYear}
          availableAssets={availableAssets}
          onSave={editIndex !== null ? handleEdit : handleAdd}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
