'use client';

import type { InvestmentAccountsHook } from './types';

interface DeleteTransactionModalProps {
  inv: InvestmentAccountsHook;
}

/** Confirm dialog for deleting a transaction. Renders null when no transaction is pending deletion. */
export default function DeleteTransactionModal({ inv }: DeleteTransactionModalProps) {
  if (!inv.deletingTxnId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-warmBg-primary sm:rounded-2xl rounded-t-2xl p-6 animate-sheetSlideUp sm:animate-cardEnter">
        <h3 className="text-base font-semibold text-warmText-primary mb-2">
          Elimina transazione
        </h3>
        <p className="text-sm text-warmText-secondary mb-5">
          Sei sicuro? Il saldo del conto verra aggiornato di conseguenza.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => inv.setDeletingTxnId(null)}
            className="flex-1 h-11 bg-warmBg-tertiary text-warmText-primary rounded-xl text-sm font-medium hover:bg-warmBg-hover transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={() => {
              // Find the transaction across all accounts
              for (const [, txns] of Object.entries(inv.rawTransactionsMap)) {
                const txn = txns.find(t => t.id === inv.deletingTxnId);
                if (txn) {
                  inv.handleDeleteTransaction(txn);
                  break;
                }
              }
            }}
            className="flex-1 h-11 bg-warmData-expense text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
}
