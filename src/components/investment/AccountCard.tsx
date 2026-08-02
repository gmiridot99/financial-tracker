'use client';

import {
  Pencil,
  Check,
  X,
  ArrowRightLeft,
  Download,
  ShoppingCart,
  Search,
  FileEdit,
  Wallet,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '@/hooks/useInvestmentAccounts';
import type { usePacRules } from '@/hooks/usePacRules';
import PacRulesPanel from '@/components/PacRulesPanel';
import type { InvestmentAccount } from '@/types/database';
import type { Holding } from '@/lib/portfolio';
import HoldingRow from './HoldingRow';
import type { InvestmentAccountsHook } from './types';

interface AccountCardProps {
  account: InvestmentAccount;
  inv: InvestmentAccountsHook;
  userId: string;
  pacRules: ReturnType<typeof usePacRules>;
  getMarketValue: (holding: Holding) => number;
  getPnL: (holding: Holding) => number;
  dailyChange: { amount: number; pct: number } | null;
  manualBuyMode: boolean;
  setManualBuyMode: (value: boolean) => void;
  manualAssetName: string;
  setManualAssetName: (value: string) => void;
  marketReferencePrice: number | null;
  setMarketReferencePrice: (value: number | null) => void;
  onDeleteRequest: (account: InvestmentAccount) => void;
}

/** Single investment account card: header, cash zone (deposit/transfer), buy form, holdings list and PAC panel. */
export default function AccountCard({
  account,
  inv,
  userId,
  pacRules,
  getMarketValue,
  getPnL,
  dailyChange,
  manualBuyMode,
  setManualBuyMode,
  manualAssetName,
  setManualAssetName,
  marketReferencePrice,
  setMarketReferencePrice,
  onDeleteRequest,
}: AccountCardProps) {
  const holdings = inv.holdingsMap[account.id] || [];
  const cashBalance = Number(account.cash_balance);
  const totalHoldingsValue = holdings.reduce((sum, h) => sum + getMarketValue(h), 0);
  const totalAccountValue = cashBalance + totalHoldingsValue;

  return (
    <div className="bg-warmBg-secondary rounded-2xl overflow-hidden animate-cardEnter">
      {/* Account Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          {inv.editingId === account.id ? (
            /* Edit name form */
            <div className="flex items-center gap-2 flex-1 mr-2">
              <input
                type="text"
                value={inv.editingName}
                onChange={(e) => inv.setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') inv.handleEditName(account.id);
                  if (e.key === 'Escape') { inv.setEditingId(null); inv.setEditingName(''); }
                }}
                className="flex-1 h-9 bg-warmBg-tertiary rounded-lg px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
                autoFocus
              />
              <button
                onClick={() => inv.handleEditName(account.id)}
                className="w-9 h-9 flex items-center justify-center text-warmData-income hover:bg-warmBg-tertiary rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => { inv.setEditingId(null); inv.setEditingName(''); }}
                className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-warmText-primary truncate">
                    {account.name}
                  </h3>
                  <button
                    onClick={() => { inv.setEditingId(account.id); inv.setEditingName(account.name); }}
                    className="w-7 h-7 flex items-center justify-center text-warmText-muted hover:text-warmText-secondary hover:bg-warmBg-tertiary rounded-lg transition-colors flex-shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <p className="text-lg font-bold text-warmText-primary">
                    {formatCurrency(totalAccountValue)}
                  </p>
                  {dailyChange !== null && (
                    <span className={`text-[11px] font-semibold ${dailyChange.amount >= 0 ? 'text-warmData-income' : 'text-warmData-expense'}`}>
                      {dailyChange.amount >= 0 ? '+' : ''}{formatCurrency(dailyChange.amount)}
                      {' '}({dailyChange.pct >= 0 ? '+' : ''}{dailyChange.pct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Cash Zone (nested card) ─────────────────────── */}
        <div className="bg-warmBg-tertiary/50 rounded-xl p-3 mt-3">
          {/* Cash header row */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-warmData-savings/15 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-4 h-4 text-warmData-savings" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-medium text-warmText-tertiary uppercase tracking-wide">Cassa</span>
              <div className="flex items-center gap-1">
                {inv.editingCashBalanceId === account.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inv.editingCashBalanceValue}
                      onChange={(e) => inv.setEditingCashBalanceValue(e.target.value)}
                      className="h-7 w-28 bg-warmBg-secondary rounded-lg px-2 text-warmText-primary text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-warmData-savings focus:ring-opacity-50"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') inv.handleEditCashBalance(account.id);
                        if (e.key === 'Escape') {
                          inv.setEditingCashBalanceId(null);
                          inv.setEditingCashBalanceValue('');
                        }
                      }}
                    />
                    <button
                      onClick={() => inv.handleEditCashBalance(account.id)}
                      className="w-6 h-6 flex items-center justify-center text-warmData-income hover:bg-warmBg-secondary rounded transition-colors"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        inv.setEditingCashBalanceId(null);
                        inv.setEditingCashBalanceValue('');
                      }}
                      className="w-6 h-6 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-secondary rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-bold text-warmText-primary">{formatCurrency(cashBalance)}</span>
                    <button
                      onClick={() => {
                        inv.setEditingCashBalanceId(account.id);
                        inv.setEditingCashBalanceValue(cashBalance.toFixed(2).replace('.', ','));
                      }}
                      className="w-5 h-5 flex items-center justify-center text-warmText-muted hover:text-warmText-secondary hover:bg-warmBg-secondary rounded transition-colors"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Cash action buttons */}
          <div className="flex items-center gap-2 mt-2.5 ml-[42px]">
            <button
              onClick={() => {
                inv.setDepositingId(inv.depositingId === account.id ? null : account.id);
                inv.setTransferringId(null);
                inv.setBuyingAccountId(null);
                inv.setDepositAmount('');
              }}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
                inv.depositingId === account.id
                  ? 'bg-warmData-income/20 text-warmData-income'
                  : 'bg-warmBg-secondary text-warmText-secondary hover:bg-warmBg-hover'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Deposita
            </button>
            <button
              onClick={() => {
                inv.setTransferringId(inv.transferringId === account.id ? null : account.id);
                inv.setDepositingId(null);
                inv.setBuyingAccountId(null);
                inv.setTransferAmount('');
                inv.setTransferDestination('');
              }}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
                inv.transferringId === account.id
                  ? 'bg-warmData-investment/20 text-warmData-investment'
                  : 'bg-warmBg-secondary text-warmText-secondary hover:bg-warmBg-hover'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Trasferisci
            </button>
            <div className="flex-1" />
            <button
              onClick={() => onDeleteRequest(account)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-warmText-muted hover:text-warmData-expense hover:bg-warmData-expense/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Portafoglio header row ───────────────────────────── */}
        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-warmText-tertiary uppercase tracking-wide">Portafoglio</span>
            {totalHoldingsValue > 0 && (
              <span className="text-sm font-bold text-warmText-primary">{formatCurrency(totalHoldingsValue)}</span>
            )}
          </div>
          <button
            onClick={() => {
              inv.setBuyingAccountId(inv.buyingAccountId === account.id ? null : account.id);
              inv.setDepositingId(null);
              inv.setTransferringId(null);
              inv.setSelectedAsset(null);
              inv.setBuyQuantity('');
              inv.setBuyPrice('');
              setMarketReferencePrice(null);
              setManualBuyMode(false);
              setManualAssetName('');
            }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
              inv.buyingAccountId === account.id
                ? 'bg-warmAccent-primary/20 text-warmAccent-primary'
                : 'bg-warmBg-tertiary text-warmText-secondary hover:bg-warmBg-hover'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Compra
          </button>
        </div>
      </div>

      {/* Deposit Form */}
      {inv.depositingId === account.id && (
        <div className="px-4 pb-4 animate-cardEnter">
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={inv.depositAmount}
              onChange={(e) => inv.setDepositAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') inv.handleDeposit(account);
                if (e.key === 'Escape') { inv.setDepositingId(null); inv.setDepositAmount(''); }
              }}
              placeholder="Importo"
              className="flex-1 h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-income focus:ring-opacity-50"
              autoFocus
            />
            <button
              onClick={() => inv.handleDeposit(account)}
              className="h-11 px-4 bg-warmData-income text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Deposita
            </button>
          </div>
          {pacRules.getRulesForAccount(account.id).filter(r => r.is_active).length > 0 && (
            <p className="text-[10px] text-warmData-investment mt-1">PAC attivo</p>
          )}
        </div>
      )}

      {/* Transfer Form */}
      {inv.transferringId === account.id && (
        <div className="px-4 pb-4 space-y-2 animate-cardEnter">
          <input
            type="text"
            inputMode="decimal"
            value={inv.transferAmount}
            onChange={(e) => inv.setTransferAmount(e.target.value)}
            placeholder="Importo"
            className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
          />
          <select
            value={inv.transferDestination}
            onChange={(e) => inv.setTransferDestination(e.target.value)}
            className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50 appearance-none"
          >
            <option value="">Seleziona destinazione</option>
            {inv.accounts.filter(a => a.id !== account.id).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            onClick={() => inv.handleTransfer(account)}
            className="w-full h-11 bg-warmData-investment text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Trasferisci
          </button>
        </div>
      )}

      {/* Buy Form */}
      {inv.buyingAccountId === account.id && (
        <div className="px-4 pb-4 space-y-2 animate-cardEnter">
          {!inv.selectedAsset && !manualBuyMode ? (
            /* Choice: search markets or manual entry */
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => inv.setShowAssetSearch(true)}
                className="h-11 bg-warmBg-tertiary rounded-xl text-warmText-secondary text-xs font-medium hover:bg-warmBg-hover transition-colors flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                Cerca su mercati
              </button>
              <button
                onClick={() => setManualBuyMode(true)}
                className="h-11 bg-warmBg-tertiary rounded-xl text-warmText-secondary text-xs font-medium hover:bg-warmBg-hover transition-colors flex items-center justify-center gap-1.5"
              >
                <FileEdit className="w-3.5 h-3.5" />
                Inserisci manualmente
              </button>
            </div>
          ) : manualBuyMode ? (
            /* Manual asset entry form */
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-warmText-tertiary">Asset manuale</span>
                <button
                  onClick={() => { setManualBuyMode(false); setManualAssetName(''); inv.setBuyQuantity(''); inv.setBuyPrice(''); }}
                  className="w-7 h-7 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={manualAssetName}
                onChange={(e) => setManualAssetName(e.target.value)}
                placeholder="Nome asset (es. Rolex, Fondo XYZ...)"
                className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={inv.buyQuantity}
                  onChange={(e) => inv.setBuyQuantity(e.target.value)}
                  placeholder="Quantita"
                  className="h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={inv.buyPrice}
                  onChange={(e) => inv.setBuyPrice(e.target.value)}
                  placeholder="Prezzo unitario"
                  className="h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
                />
              </div>
              <input
                type="date"
                value={inv.buyDate}
                onChange={(e) => inv.setBuyDate(e.target.value)}
                className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
              />
              {inv.buyTotal > 0 && (
                <p className="text-xs text-warmText-secondary">
                  Totale: <span className="font-bold">{formatCurrency(inv.buyTotal)}</span>
                  <span className="text-warmText-muted"> (disp: {formatCurrency(cashBalance)})</span>
                </p>
              )}
              <button
                onClick={() => {
                  inv.handleBuyManual(account, manualAssetName, inv.buyQuantity, inv.buyPrice, inv.buyDate);
                  setManualBuyMode(false);
                  setManualAssetName('');
                }}
                className="w-full h-11 bg-warmAccent-primary text-white rounded-xl text-sm font-medium hover:bg-warmAccent-hover transition-colors"
              >
                Aggiungi asset
              </button>
            </>
          ) : (
            /* Market asset selected - existing buy form */
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-warmText-primary">{inv.selectedAsset!.symbol}</span>
                  <span className="text-xs text-warmText-tertiary">{inv.selectedAsset!.name}</span>
                </div>
                <button
                  onClick={() => { inv.setSelectedAsset(null); setMarketReferencePrice(null); }}
                  className="w-7 h-7 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={inv.buyQuantity}
                  onChange={(e) => inv.setBuyQuantity(e.target.value)}
                  placeholder="Quantita"
                  className="h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={inv.buyPrice}
                  onChange={(e) => inv.setBuyPrice(e.target.value)}
                  placeholder={marketReferencePrice ? `${formatCurrency(marketReferencePrice)}` : 'Prezzo unitario'}
                  className="h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
                />
              </div>
              {marketReferencePrice !== null && (
                <p className="text-[10px] text-warmText-tertiary -mt-1">
                  Prezzo di mercato: <span className="font-semibold text-warmText-secondary">{formatCurrency(marketReferencePrice)}</span>
                </p>
              )}
              <input
                type="date"
                value={inv.buyDate}
                onChange={(e) => inv.setBuyDate(e.target.value)}
                className="w-full h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmAccent-primary focus:ring-opacity-50"
              />
              {inv.buyTotal > 0 && (
                <p className="text-xs text-warmText-secondary">
                  Totale: <span className="font-bold">{formatCurrency(inv.buyTotal)}</span>
                  <span className="text-warmText-muted"> (disp: {formatCurrency(cashBalance)})</span>
                </p>
              )}
              <button
                onClick={() => inv.handleBuy(account)}
                className="w-full h-11 bg-warmAccent-primary text-white rounded-xl text-sm font-medium hover:bg-warmAccent-hover transition-colors"
              >
                Acquista
              </button>
            </>
          )}
        </div>
      )}

      {/* Holdings Section (always visible) */}
      {holdings.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          {holdings.map(holding => (
            <HoldingRow
              key={holding.symbol}
              account={account}
              holding={holding}
              inv={inv}
              getMarketValue={getMarketValue}
              getPnL={getPnL}
            />
          ))}
        </div>
      )}

      {/* PAC Rules Panel (always visible, inside each card) */}
      <div className="px-4 pb-4">
        <PacRulesPanel accountId={account.id} userId={userId} />
      </div>
    </div>
  );
}
