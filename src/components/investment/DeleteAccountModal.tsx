'use client';

import { formatCurrency } from '@/hooks/useInvestmentAccounts';
import type { InvestmentAccount } from '@/types/database';
import type { Holding } from '@/lib/portfolio';
import type { InvestmentAccountsHook } from './types';

interface DeleteAccountModalProps {
  inv: InvestmentAccountsHook;
  deletingAccount: InvestmentAccount | null;
  onClose: () => void;
  getMarketValue: (holding: Holding) => number;
}

/** Confirm dialog for deleting an investment account (shows cash/holdings that will be discarded). Renders null when no account is pending deletion. */
export default function DeleteAccountModal({ inv, deletingAccount, onClose, getMarketValue }: DeleteAccountModalProps) {
  if (!deletingAccount) return null;

  const delCash = Number(deletingAccount.cash_balance);
  const delHoldings = inv.holdingsMap[deletingAccount.id] || [];
  const delHoldingsValue = delHoldings.reduce((sum, h) => sum + getMarketValue(h), 0);
  const delTotal = delCash + delHoldingsValue;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-warmBg-primary sm:rounded-2xl rounded-t-2xl p-6 animate-sheetSlideUp sm:animate-cardEnter">
        <h3 className="text-base font-semibold text-warmText-primary mb-2">
          Elimina conto
        </h3>
        <p className="text-sm text-warmText-secondary mb-1">
          Sei sicuro di voler eliminare &ldquo;{deletingAccount.name}&rdquo;?
        </p>
        {delTotal > 0 && (
          <div className="text-sm text-warmData-expense font-medium mb-1 space-y-0.5">
            {delCash > 0 && <p>Liquidita: {formatCurrency(delCash)} verra scartata</p>}
            {delHoldings.length > 0 && (
              <p>Titoli ({delHoldings.length}): {formatCurrency(delHoldingsValue)} verranno scartati</p>
            )}
          </div>
        )}
        <p className="text-xs text-warmText-tertiary mb-5">
          Questa azione non puo essere annullata.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 bg-warmBg-tertiary text-warmText-primary rounded-xl text-sm font-medium hover:bg-warmBg-hover transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={() => {
              inv.handleDelete(deletingAccount);
              onClose();
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
