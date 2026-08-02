'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/hooks/useInvestmentAccounts';
import type { InvestmentAccountsHook } from './types';

interface SellHoldingModalProps {
  inv: InvestmentAccountsHook;
}

/** Modal for selling (all or part of) a holding. Renders null when no holding is being sold. */
export default function SellHoldingModal({ inv }: SellHoldingModalProps) {
  if (!inv.sellingHolding) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-warmBg-primary sm:rounded-2xl rounded-t-2xl p-6 space-y-4 animate-sheetSlideUp sm:animate-cardEnter">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-warmText-primary">
            Vendi {inv.sellingHolding.holding.symbol}
          </h3>
          <button
            onClick={() => { inv.setSellingHolding(null); inv.setSellQuantity(''); inv.setSellPrice(''); }}
            className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-warmText-tertiary mb-1 block">Quantita (max: {inv.sellingHolding.holding.quantity})</label>
            <input
              type="text"
              inputMode="decimal"
              value={inv.sellQuantity}
              onChange={(e) => inv.setSellQuantity(e.target.value)}
              placeholder="Quantita"
              className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-expense focus:ring-opacity-50"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-warmText-tertiary mb-1 block">Prezzo unitario</label>
            <input
              type="text"
              inputMode="decimal"
              value={inv.sellPrice}
              onChange={(e) => inv.setSellPrice(e.target.value)}
              placeholder="Prezzo"
              className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-expense focus:ring-opacity-50"
            />
          </div>
        </div>

        {inv.sellTotal > 0 && (
          <p className="text-sm text-warmText-secondary">
            Totale: <span className="font-bold">{formatCurrency(inv.sellTotal)}</span>
          </p>
        )}


        <button
          onClick={inv.handleSell}
          className="w-full h-11 bg-warmData-expense text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Vendi
        </button>
      </div>
    </div>
  );
}
