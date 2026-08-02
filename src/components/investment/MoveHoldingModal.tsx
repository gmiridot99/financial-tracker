'use client';

import { X, ArrowRightLeft } from 'lucide-react';
import { formatCurrency, parseEuropeanDecimal } from '@/hooks/useInvestmentAccounts';
import type { InvestmentAccountsHook } from './types';

interface MoveHoldingModalProps {
  inv: InvestmentAccountsHook;
}

/** Modal for moving (all or part of) a holding to another account. Renders null when no holding is being moved. */
export default function MoveHoldingModal({ inv }: MoveHoldingModalProps) {
  if (!inv.movingHolding) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-warmBg-primary sm:rounded-2xl rounded-t-2xl p-6 space-y-4 animate-sheetSlideUp sm:animate-cardEnter">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-warmText-primary">
            Sposta {inv.movingHolding.holding.symbol}
          </h3>
          <button
            onClick={() => { inv.setMovingHolding(null); inv.setMoveQuantity(''); inv.setMoveDestination(''); }}
            className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-xs text-warmText-tertiary mb-1 block">
            Quantità (max: {inv.movingHolding.holding.quantity})
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={inv.moveQuantity}
            onChange={(e) => inv.setMoveQuantity(e.target.value)}
            placeholder="Quantità"
            className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-warmText-tertiary mb-1 block">Conto destinazione</label>
          <select
            value={inv.moveDestination}
            onChange={(e) => inv.setMoveDestination(e.target.value)}
            className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50 appearance-none"
          >
            <option value="">Seleziona conto</option>
            {inv.accounts
              .filter(a => a.id !== inv.movingHolding!.accountId)
              .map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
          </select>
        </div>

        <div className="text-xs text-warmText-tertiary">
          Prezzo medio: <span className="font-semibold text-warmText-secondary">
            {formatCurrency(inv.movingHolding.holding.avgPrice)}
          </span>
          {inv.moveQuantity && !isNaN(parseEuropeanDecimal(inv.moveQuantity)) && parseEuropeanDecimal(inv.moveQuantity) > 0 && (
            <span className="ml-2">
              → Valore: <span className="font-semibold text-warmText-primary">
                {formatCurrency(Math.round(parseEuropeanDecimal(inv.moveQuantity) * inv.movingHolding.holding.avgPrice * 100) / 100)}
              </span>
            </span>
          )}
        </div>

        <button
          onClick={inv.handleMoveHolding}
          className="w-full h-11 bg-warmData-investment text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <ArrowRightLeft className="w-4 h-4" />
          Sposta asset
        </button>
      </div>
    </div>
  );
}
