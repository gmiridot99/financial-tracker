'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { useInvestmentAccounts } from '@/hooks/useInvestmentAccounts';
import { usePacRules } from '@/hooks/usePacRules';
import { executePac } from '@/lib/pac-execution';
import AssetSearchModal from '@/components/AssetSearchModal';
import { supabase } from '@/lib/supabase';
import type { InvestmentAccount } from '@/types/database';
import type { Holding } from '@/lib/portfolio';
import toast from 'react-hot-toast';
import AccountCard from '@/components/investment/AccountCard';
import CreateAccountForm from '@/components/investment/CreateAccountForm';
import SellHoldingModal from '@/components/investment/SellHoldingModal';
import MoveHoldingModal from '@/components/investment/MoveHoldingModal';
import EditTransactionModal from '@/components/investment/EditTransactionModal';
import DeleteTransactionModal from '@/components/investment/DeleteTransactionModal';
import DeleteAccountModal from '@/components/investment/DeleteAccountModal';

// ── Types ────────────────────────────────────────────────────────────

interface InvestmentAccountsListProps {
  userId: string;
  onAccountsChanged?: () => void;
  onTotalMarketValue?: (value: number, totalCostBasis: number) => void;
  onPricesLoadingChange?: (loading: boolean) => void;
  onDistributionData?: (data: import('@/hooks/useInvestmentAccounts').InvestmentDistributionData) => void;
}

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
      {inv.accounts.map(account => (
        <AccountCard
          key={account.id}
          account={account}
          inv={inv}
          userId={userId}
          pacRules={pacRules}
          getMarketValue={getMarketValue}
          getPnL={getPnL}
          dailyChange={getAccountDailyChange(account.id)}
          manualBuyMode={manualBuyMode}
          setManualBuyMode={setManualBuyMode}
          manualAssetName={manualAssetName}
          setManualAssetName={setManualAssetName}
          marketReferencePrice={marketReferencePrice}
          setMarketReferencePrice={setMarketReferencePrice}
          onDeleteRequest={setDeletingAccount}
        />
      ))}

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
      <CreateAccountForm inv={inv} />

      {/* Sell Modal */}
      <SellHoldingModal inv={inv} />

      {/* Move Holding Modal */}
      <MoveHoldingModal inv={inv} />

      {/* Edit Transaction Modal */}
      <EditTransactionModal inv={inv} />

      {/* Delete Transaction Confirm */}
      <DeleteTransactionModal inv={inv} />

      {/* Delete Account Confirm */}
      <DeleteAccountModal
        inv={inv}
        deletingAccount={deletingAccount}
        onClose={() => setDeletingAccount(null)}
        getMarketValue={getMarketValue}
      />

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
