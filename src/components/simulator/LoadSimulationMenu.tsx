'use client';

import { useState } from 'react';
import { FolderOpen, Trash2, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface SavedSimulationItem {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface LoadSimulationMenuProps {
  simulations: SavedSimulationItem[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export default function LoadSimulationMenu({
  simulations,
  onLoad,
  onDelete,
  onClose,
}: LoadSimulationMenuProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Sei sicuro di voler eliminare "${name}"?`)) return;

    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-10 bg-black/50 sm:bg-transparent" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 w-full rounded-t-2xl max-h-[70vh] pb-[env(safe-area-inset-bottom)] animate-sheetSlideUp sm:animate-none sm:absolute sm:inset-auto sm:right-0 sm:bottom-auto sm:mt-2 sm:w-80 sm:rounded-lg sm:max-h-96 sm:pb-0 bg-warmBg-secondary border border-warmBg-tertiary z-20 overflow-hidden overflow-y-auto">
        <div className="w-12 h-1 bg-warmText-disabled rounded-full mx-auto mt-2 sm:hidden" />
        <div className="p-2">
          {simulations.length === 0 ? (
            <div className="p-6 text-center text-warmText-tertiary">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nessuna simulazione salvata</p>
            </div>
          ) : (
            simulations.map((sim) => (
              <div
                key={sim.id}
                className="group flex items-center justify-between p-3 hover:bg-warmBg-tertiary rounded-md transition-colors mb-1 cursor-pointer"
                onClick={() => onLoad(sim.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-warmText-primary truncate">
                    {sim.name}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-warmText-tertiary mt-1">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    {formatDistanceToNow(new Date(sim.updated_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, sim.id, sim.name)}
                  disabled={deletingId === sim.id}
                  className="p-2 text-warmText-disabled hover:text-warmData-expense hover:bg-warmBg-primary rounded-md transition-colors sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-50 flex-shrink-0 ml-2"
                  title="Elimina"
                >
                  {deletingId === sim.id ? (
                    <div className="w-4 h-4 border-2 border-warmData-expense border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
