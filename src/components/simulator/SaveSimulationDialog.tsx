'use client';

import { useState } from 'react';
import { X, Save } from 'lucide-react';

interface SaveSimulationDialogProps {
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export default function SaveSimulationDialog({ onClose, onSave }: SaveSimulationDialogProps) {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Inserisci un nome per la simulazione');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center sm:p-4">
      <div className="bg-warmBg-secondary border border-warmBg-tertiary w-full h-full flex flex-col p-6 sm:h-auto sm:max-w-md sm:rounded-2xl animate-sheetSlideUp sm:animate-none">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-warmText-primary">
            Salva Simulazione
          </h3>
          <button onClick={onClose} className="p-1 text-warmText-tertiary hover:text-warmText-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-warmText-secondary mb-2">
            Nome Simulazione
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="es. Scenario Base 2026"
            maxLength={100}
            className="w-full h-11 px-3 bg-warmBg-tertiary border border-warmBg-hover text-warmText-primary rounded-xl focus:ring-2 focus:ring-warmAccent-primary focus:border-transparent"
            autoFocus
          />
          {error && (
            <p className="text-sm text-warmData-expense mt-2">{error}</p>
          )}
          <p className="text-xs text-warmText-tertiary mt-2">
            Se esiste già una simulazione con lo stesso nome, verrà sovrascritta.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 mt-auto sm:mt-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-warmText-tertiary hover:text-warmText-secondary transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-warmAccent-primary hover:bg-warmAccent-hover disabled:bg-warmBg-tertiary disabled:text-warmText-disabled text-warmText-primary rounded-lg font-medium transition-colors"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-warmText-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Salvando...' : 'Salva'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
