'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/hooks/useInvestmentAccounts';
import type { InvestmentAccountsHook } from './types';

interface EditTransactionModalProps {
  inv: InvestmentAccountsHook;
}

/** Modal for editing an existing buy/sell transaction. Renders null when no transaction is being edited. */
export default function EditTransactionModal({ inv }: EditTransactionModalProps) {
  if (!inv.editingTxn) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-warmBg-primary sm:rounded-2xl rounded-t-2xl p-6 space-y-4 animate-sheetSlideUp sm:animate-cardEnter">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-warmText-primary">
            Modifica transazione - {inv.editingTxn.assetSymbol}
          </h3>
          <button
            onClick={() => inv.setEditingTxn(null)}
            className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-warmText-tertiary mb-1 block">Quantita</label>
            <input
              type="text"
              inputMode="decimal"
              value={inv.editingTxn.quantity}
              onChange={(e) => inv.setEditingTxn({ ...inv.editingTxn!, quantity: e.target.value })}
              className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-warmText-tertiary mb-1 block">Prezzo unitario</label>
            <input
              type="text"
              inputMode="decimal"
              value={inv.editingTxn.pricePerUnit}
              onChange={(e) => inv.setEditingTxn({ ...inv.editingTxn!, pricePerUnit: e.target.value })}
              className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-warmText-tertiary mb-1 block">Data</label>
          <input
            type="date"
            value={inv.editingTxn.transactionDate}
            onChange={(e) => inv.setEditingTxn({ ...inv.editingTxn!, transactionDate: e.target.value })}
            className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
          />
        </div>

        {inv.editTotal > 0 && (
          <p className="text-sm text-warmText-secondary">
            Nuovo totale: <span className="font-bold">{formatCurrency(inv.editTotal)}</span>
            {inv.editTotal !== inv.editingTxn.originalTotalAmount && (
              <span className="text-warmText-muted ml-1">
                (prima: {formatCurrency(inv.editingTxn.originalTotalAmount)})
              </span>
            )}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => inv.setEditingTxn(null)}
            className="flex-1 h-11 bg-warmBg-tertiary text-warmText-primary rounded-xl text-sm font-medium hover:bg-warmBg-hover transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={inv.handleEditTransaction}
            className="flex-1 h-11 bg-warmAccent-primary text-white rounded-xl text-sm font-medium hover:bg-warmAccent-hover transition-colors"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
