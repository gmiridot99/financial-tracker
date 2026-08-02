'use client';

import { Pencil, X, DollarSign, ArrowRightLeft, TrendingUp, TrendingDown, Loader2, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
const AssetPriceChart = dynamic(() => import('@/components/AssetPriceChart'), { ssr: false });
import { formatCurrency } from '@/hooks/useInvestmentAccounts';
import type { InvestmentAccount } from '@/types/database';
import type { Holding } from '@/lib/portfolio';
import { TYPE_BADGE_STYLES, TYPE_LABELS, type InvestmentAccountsHook } from './types';

interface HoldingRowProps {
  account: InvestmentAccount;
  holding: Holding;
  inv: InvestmentAccountsHook;
  getMarketValue: (holding: Holding) => number;
  getPnL: (holding: Holding) => number;
}

/** Single holding row within an investment account card: summary, expand/collapse, and expanded actions (edit/sell/move/history). */
export default function HoldingRow({ account, holding, inv, getMarketValue, getPnL }: HoldingRowProps) {
  const isManual = holding.type === 'manual';
  const marketValue = getMarketValue(holding);
  const pnl = isManual ? 0 : getPnL(holding);
  const pnlPct = isManual ? 0 : (holding.costBasis > 0 ? (pnl / holding.costBasis) * 100 : 0);
  const price = inv.marketPrices.get(holding.symbol);
  const isHoldingExpanded = inv.expandedHolding === `${account.id}:${holding.symbol}`;

  return (
    <div className="bg-warmBg-tertiary/50 rounded-xl p-3">
      {/* Row 1: Symbol + badge + name | Value + P&L */}
      <button
        onClick={() => inv.setExpandedHolding(isHoldingExpanded ? null : `${account.id}:${holding.symbol}`)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-warmText-primary">{holding.symbol}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase ${TYPE_BADGE_STYLES[holding.type] ?? TYPE_BADGE_STYLES.stock}`}>
                {TYPE_LABELS[holding.type] ?? holding.type}
              </span>
            </div>
            <p className="text-[10px] text-warmText-tertiary truncate text-left">{holding.name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-warmText-primary">{formatCurrency(marketValue)}</p>
          {isManual ? (
            <p className="text-[10px] font-medium text-warmText-tertiary">
              {formatCurrency(0)} (0.0%)
            </p>
          ) : (
            <p className={`text-[10px] font-medium ${pnl >= 0 ? 'text-warmData-income' : 'text-warmData-expense'}`}>
              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
            </p>
          )}
        </div>
      </button>

      {/* Row 2: Qtà | PMC | Prezzo (always visible) */}
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-warmText-tertiary">
        <span>Qtà: <span className="font-semibold text-warmText-secondary">{holding.quantity}</span></span>
        <span>PMC: <span className="font-semibold text-warmText-secondary">{formatCurrency(holding.avgPrice)}</span></span>
        {!isManual && (
          <span>
            Prezzo: <span className="font-semibold text-warmText-secondary">
              {price ? formatCurrency(price.priceEur) : inv.pricesLoading ? <Loader2 className="inline w-2.5 h-2.5 animate-spin" /> : '-'}
            </span>
          </span>
        )}
      </div>

      {/* Expanded holding details (chart, edit, sell, history) */}
      {isHoldingExpanded && (
        <div className="mt-3 pt-3 border-t border-warmBg-tertiary space-y-2 animate-cardEnter">
          {inv.editingHoldingKey === `${account.id}:${holding.symbol}` ? (
            /* Inline holding adjustment form */
            <div className="space-y-2">
              <p className="text-xs font-medium text-warmText-secondary">Modifica posizione</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-warmText-tertiary block mb-1">Quantità</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inv.editingHoldingQty}
                    onChange={(e) => inv.setEditingHoldingQty(e.target.value)}
                    placeholder={String(holding.quantity)}
                    className="w-full h-9 bg-warmBg-secondary rounded-lg px-2 text-warmText-primary text-xs focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] text-warmText-tertiary block mb-1">Prezzo medio</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inv.editingHoldingPrice}
                    onChange={(e) => inv.setEditingHoldingPrice(e.target.value)}
                    placeholder={String(holding.avgPrice).replace('.', ',')}
                    className="w-full h-9 bg-warmBg-secondary rounded-lg px-2 text-warmText-primary text-xs focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => inv.handleAdjustHolding(account, holding)}
                  className="flex-1 h-9 bg-warmAccent-primary text-white rounded-lg text-xs font-medium hover:bg-warmAccent-hover transition-colors"
                >
                  Salva
                </button>
                <button
                  onClick={() => {
                    inv.setEditingHoldingKey(null);
                    inv.setEditingHoldingQty('');
                    inv.setEditingHoldingPrice('');
                  }}
                  className="h-9 w-9 flex items-center justify-center bg-warmBg-tertiary text-warmText-tertiary rounded-lg hover:bg-warmBg-hover transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Modifica holding button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  inv.setEditingHoldingKey(`${account.id}:${holding.symbol}`);
                  inv.setEditingHoldingQty(String(holding.quantity).replace('.', ','));
                  inv.setEditingHoldingPrice(String(holding.avgPrice).replace('.', ','));
                }}
                className="w-full h-8 bg-warmBg-tertiary text-warmText-secondary rounded-lg text-xs font-medium hover:bg-warmBg-hover transition-colors flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-3 h-3" />
                Modifica
              </button>

              {/* Price Chart (only for market assets) */}
              {!isManual && (
                <AssetPriceChart symbol={holding.symbol} avgPrice={holding.avgPrice} />
              )}

              {/* Sell button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  inv.setSellingHolding({ accountId: account.id, holding });
                  inv.setSellQuantity('');
                  inv.setSellPrice(isManual ? '' : (price ? String(price.priceEur).replace('.', ',') : ''));
                }}
                className="w-full h-9 bg-warmData-expense/10 text-warmData-expense rounded-lg text-xs font-medium hover:bg-warmData-expense/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Vendi
              </button>

              {/* Move button — solo visibile se ci sono altri conti */}
              {inv.accounts.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    inv.setMovingHolding({ accountId: account.id, holding });
                    inv.setMoveQuantity('');
                    inv.setMoveDestination('');
                  }}
                  className="w-full h-9 bg-warmData-investment/10 text-warmData-investment rounded-lg text-xs font-medium hover:bg-warmData-investment/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Sposta
                </button>
              )}
            </>
          )}

          {/* Transaction history */}
          {(inv.rawTransactionsMap[account.id] || [])
            .filter(t => t.asset_symbol === holding.symbol)
            .slice(0, 5)
            .map(txn => (
              <div key={txn.id} className="flex items-center justify-between text-[10px] py-1">
                <div className="flex items-center gap-1.5">
                  {txn.transaction_type === 'buy' ? (
                    <TrendingUp className="w-3 h-3 text-warmData-income" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-warmData-expense" />
                  )}
                  <span className="text-warmText-secondary">{txn.transaction_date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-warmText-primary font-medium">
                    {txn.quantity} x {formatCurrency(txn.price_per_unit)}
                  </span>
                  <button
                    onClick={() => inv.startEditTransaction(txn, account.id)}
                    className="w-6 h-6 flex items-center justify-center text-warmText-muted hover:text-warmText-secondary rounded"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => inv.setDeletingTxnId(txn.id)}
                    className="w-6 h-6 flex items-center justify-center text-warmText-muted hover:text-warmData-expense rounded"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
