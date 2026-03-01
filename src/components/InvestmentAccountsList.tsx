'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowRightLeft,
  Download,
  ShoppingCart,
  DollarSign,
  Loader2,
  TrendingUp,
  TrendingDown,
  Search,
  FileEdit,
  Wallet,
} from 'lucide-react';
import { useInvestmentAccounts, formatCurrency, parseEuropeanDecimal } from '@/hooks/useInvestmentAccounts';
import { usePacRules } from '@/hooks/usePacRules';
import { executePac } from '@/lib/pac-execution';
import AssetSearchModal from '@/components/AssetSearchModal';
import PacRulesPanel from '@/components/PacRulesPanel';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
const AssetPriceChart = dynamic(() => import('@/components/AssetPriceChart'), { ssr: false });
import type { InvestmentAccount } from '@/types/database';
import type { Holding } from '@/lib/portfolio';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────

interface InvestmentAccountsListProps {
  userId: string;
  onAccountsChanged?: () => void;
  onTotalMarketValue?: (value: number, totalCostBasis: number) => void;
  onPricesLoadingChange?: (loading: boolean) => void;
  onDistributionData?: (data: import('@/hooks/useInvestmentAccounts').InvestmentDistributionData) => void;
}

// ── Constants ────────────────────────────────────────────────────────

const TYPE_BADGE_STYLES: Record<string, string> = {
  stock: 'bg-blue-500/20 text-blue-300',
  etf: 'bg-emerald-500/20 text-emerald-300',
  crypto: 'bg-orange-500/20 text-orange-300',
  index: 'bg-purple-500/20 text-purple-300',
  bond: 'bg-gray-500/20 text-gray-300',
  commodity: 'bg-amber-500/20 text-amber-300',
  manual: 'bg-warmText-tertiary/20 text-warmText-secondary',
};

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stock',
  etf: 'ETF',
  crypto: 'Crypto',
  index: 'Index',
  bond: 'Bond',
  commodity: 'Commodity',
  manual: 'Manuale',
};

// ── Component ────────────────────────────────────────────────────────

export default function InvestmentAccountsList({
  userId,
  onAccountsChanged,
  onTotalMarketValue,
  onPricesLoadingChange,
  onDistributionData,
}: InvestmentAccountsListProps) {
  const [deletingAccount, setDeletingAccount] = useState<InvestmentAccount | null>(null);
  const [marketReferencePrice, setMarketReferencePrice] = useState<number | null>(null);
  const [manualBuyMode, setManualBuyMode] = useState(false);
  const [manualAssetName, setManualAssetName] = useState('');
  const [yesterdayPrices, setYesterdayPrices] = useState<Map<string, number>>(new Map());

  // PAC rules hook
  const pacRules = usePacRules({ userId });

  // PAC executor callback - wired into useInvestmentAccounts
  const handlePacExecution = useCallback(async (accountId: string, depositAmount: number) => {
    const accountRules = pacRules.getRulesForAccount(accountId);
    const activeRules = accountRules.filter(r => r.is_active);

    if (activeRules.length === 0) return;

    const result = await executePac({
      userId,
      accountId,
      depositAmount,
      rules: activeRules,
    });

    if (result.applied.length > 0) {
      const summary = result.applied
        .map(a => `${a.quantity.toFixed(a.quantity < 1 ? 6 : 2)} ${a.symbol}`)
        .join(', ');
      toast.success(`PAC applicato: ${summary}`, { duration: 5000 });
    }

    if (result.skipped.length > 0) {
      const skippedSummary = result.skipped
        .map(s => `${s.symbol}: ${s.reason}`)
        .join('; ');
      toast.error(`PAC: asset saltati - ${skippedSummary}`, { duration: 5000 });
    }

    // Reload PAC rules to stay in sync
    await pacRules.loadRules();
  }, [userId, pacRules]);

  const inv = useInvestmentAccounts({
    userId,
    onAccountsChanged,
    onTotalMarketValue,
    onDistributionData,
    pacExecutor: handlePacExecution,
  });

  // Propagate prices loading state to parent
  useEffect(() => {
    onPricesLoadingChange?.(inv.pricesLoading);
  }, [inv.pricesLoading, onPricesLoadingChange]);

  // Fetch yesterday's prices for daily change computation
  useEffect(() => {
    const symbols = [...inv.marketPrices.keys()];
    if (symbols.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoStr = fiveDaysAgo.toISOString().slice(0, 10);

    supabase
      .from('asset_price_history')
      .select('symbol, price_eur, price_date')
      .in('symbol', symbols)
      .gte('price_date', fiveDaysAgoStr)
      .lt('price_date', today)
      .order('price_date', { ascending: false })
      .then(({ data }) => {
        const prices = new Map<string, number>();
        for (const row of data ?? []) {
          if (!prices.has(row.symbol)) {
            prices.set(row.symbol, Number(row.price_eur));
          }
        }
        setYesterdayPrices(prices);
      });
  }, [inv.marketPrices]);

  // ── Helpers ──────────────────────────────────────────────────────

  const getMarketValue = (holding: Holding): number => {
    const price = inv.marketPrices.get(holding.symbol);
    return holding.quantity * (price ? price.priceEur : holding.avgPrice);
  };

  const getPnL = (holding: Holding): number => {
    return getMarketValue(holding) - holding.costBasis;
  };

  // Returns daily P&L (amount + pct) for a given account, based on yesterday's prices.
  // Returns null when there is no usable price history (e.g. new portfolio, manual assets only).
  const getAccountDailyChange = useMemo(() => {
    return (accountId: string): { amount: number; pct: number } | null => {
      const holdings = inv.holdingsMap[accountId] || [];
      let changeAmount = 0;
      let prevTotalValue = 0;
      let hasData = false;

      for (const h of holdings) {
        if (h.type === 'manual') continue;
        const todayPrice = inv.marketPrices.get(h.symbol)?.priceEur;
        const yesterdayPrice = yesterdayPrices.get(h.symbol);
        if (!todayPrice || !yesterdayPrice) continue;
        changeAmount += h.quantity * (todayPrice - yesterdayPrice);
        prevTotalValue += h.quantity * yesterdayPrice;
        hasData = true;
      }

      if (!hasData) return null;
      const pct = prevTotalValue > 0 ? (changeAmount / prevTotalValue) * 100 : 0;
      return {
        amount: Math.round(changeAmount * 100) / 100,
        pct: Math.round(pct * 100) / 100,
      };
    };
  }, [inv.holdingsMap, inv.marketPrices, yesterdayPrices]);

  // ── Render ───────────────────────────────────────────────────────

  if (inv.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-warmText-tertiary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Account Cards */}
      {inv.accounts.map(account => {
        const holdings = inv.holdingsMap[account.id] || [];
        const cashBalance = Number(account.cash_balance);
        const totalHoldingsValue = holdings.reduce((sum, h) => sum + getMarketValue(h), 0);
        const totalAccountValue = cashBalance + totalHoldingsValue;
        const dailyChange = getAccountDailyChange(account.id);

        return (
          <div key={account.id} className="bg-warmBg-secondary rounded-2xl overflow-hidden animate-cardEnter">
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
                    onClick={() => setDeletingAccount(account)}
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
                {holdings.map(holding => {
                  const isManual = holding.type === 'manual';
                  const marketValue = getMarketValue(holding);
                  const pnl = isManual ? 0 : getPnL(holding);
                  const pnlPct = isManual ? 0 : (holding.costBasis > 0 ? (pnl / holding.costBasis) * 100 : 0);
                  const price = inv.marketPrices.get(holding.symbol);
                  const isHoldingExpanded = inv.expandedHolding === `${account.id}:${holding.symbol}`;

                  return (
                    <div key={holding.symbol} className="bg-warmBg-tertiary/50 rounded-xl p-3">
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
                })}
              </div>
            )}

            {/* PAC Rules Panel (always visible, inside each card) */}
            <div className="px-4 pb-4">
              <PacRulesPanel accountId={account.id} userId={userId} />
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {inv.accounts.length === 0 && !inv.showCreateForm && (
        <div className="py-10 flex flex-col items-center text-center gap-3">
          <div className="p-4 bg-warmData-investment/10 rounded-2xl">
            <TrendingUp className="w-8 h-8 text-warmData-investment" />
          </div>
          <p className="text-warmText-secondary font-medium">Nessun conto investimento</p>
          <p className="text-sm text-warmText-tertiary">Crea il primo conto per iniziare a tracciare il tuo portafoglio</p>
        </div>
      )}

      {/* Create Account Form */}
      {inv.showCreateForm ? (
        <div className="bg-warmBg-secondary rounded-2xl p-4 animate-cardEnter">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inv.newAccountName}
              onChange={(e) => inv.setNewAccountName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') inv.handleCreate();
                if (e.key === 'Escape') { inv.setShowCreateForm(false); inv.setNewAccountName(''); }
              }}
              placeholder="Nome del conto"
              className="flex-1 h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
              autoFocus
            />
            <button
              onClick={inv.handleCreate}
              className="h-11 px-4 bg-warmData-investment text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Crea
            </button>
            <button
              onClick={() => { inv.setShowCreateForm(false); inv.setNewAccountName(''); }}
              className="w-11 h-11 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inv.setShowCreateForm(true)}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed border-warmBg-tertiary text-warmText-tertiary text-sm font-medium hover:border-warmData-investment hover:text-warmData-investment transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuovo conto investimento
        </button>
      )}

      {/* Sell Modal */}
      {inv.sellingHolding && (
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
      )}

      {/* Move Holding Modal */}
      {inv.movingHolding && (
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
      )}

      {/* Edit Transaction Modal */}
      {inv.editingTxn && (
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
      )}

      {/* Delete Transaction Confirm */}
      {inv.deletingTxnId && (
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
                  for (const [accId, txns] of Object.entries(inv.rawTransactionsMap)) {
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
      )}

      {/* Delete Account Confirm */}
      {deletingAccount && (() => {
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
                  onClick={() => setDeletingAccount(null)}
                  className="flex-1 h-11 bg-warmBg-tertiary text-warmText-primary rounded-xl text-sm font-medium hover:bg-warmBg-hover transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    inv.handleDelete(deletingAccount);
                    setDeletingAccount(null);
                  }}
                  className="flex-1 h-11 bg-warmData-expense text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Asset Search Modal (for buy) */}
      <AssetSearchModal
        isOpen={inv.showAssetSearch}
        onClose={() => inv.setShowAssetSearch(false)}
        onSelect={async (asset) => {
          inv.setSelectedAsset(asset);
          inv.setShowAssetSearch(false);
          setMarketReferencePrice(null);

          // 1. Try market prices from current holdings
          const holdingPrice = inv.marketPrices.get(asset.symbol);
          if (holdingPrice) {
            inv.setBuyPrice(String(holdingPrice.priceEur).replace('.', ','));
            setMarketReferencePrice(holdingPrice.priceEur);
            return;
          }

          // 2. Fallback: look up from asset_prices_cache
          const { data: cached } = await supabase
            .from('asset_prices_cache')
            .select('current_price, price_currency')
            .eq('symbol', asset.symbol)
            .maybeSingle();

          if (cached?.current_price) {
            const priceEur = cached.current_price;
            inv.setBuyPrice(String(priceEur).replace('.', ','));
            setMarketReferencePrice(priceEur);
          }
        }}
      />
    </div>
  );
}
