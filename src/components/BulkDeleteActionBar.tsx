'use client';

import { Trash2, RefreshCw } from 'lucide-react';

interface BulkDeleteActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export default function BulkDeleteActionBar({
  selectedCount,
  onCancel,
  onDelete,
  isDeleting
}: BulkDeleteActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slideInUp">
      <div className="bg-warmBg-secondary border-t-2 border-warmData-expense px-4 py-4 shadow-2xl">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <span className="text-sm font-medium text-warmText-secondary">
            {selectedCount} selezionate
          </span>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="px-4 py-2 border border-warmText-muted rounded-xl text-warmText-secondary font-medium hover:bg-warmBg-tertiary transition-colors disabled:opacity-50"
            >
              Annulla
            </button>

            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-warmData-expense text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Elimina
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
