'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { InvestmentAccount } from '@/types/database';
import { computeHoldings, type Holding } from '@/lib/portfolio';
import { fetchMarketPrices, type MarketPrice } from '@/lib/market-prices';
import toast from 'react-hot-toast';
import type { InvestmentDistributionData, RawTransaction } from './types';

// Known CoinGecko IDs for common crypto symbols — used as fallback when the
// asset_prices_cache entry doesn't exist yet (e.g. first load after manual buy).
const KNOWN_CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple',
  ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2', MATIC: 'matic-network',
  LINK: 'chainlink', UNI: 'uniswap', ATOM: 'cosmos', NEAR: 'near',
  USDT: 'tether', USDC: 'usd-coin', DAI: 'dai',
  PAXG: 'pax-gold', BNB: 'binancecoin', LTC: 'litecoin', BCH: 'bitcoin-cash',
  DOGE: 'dogecoin', SHIB: 'shiba-inu', TON: 'the-open-network',
  PEPE: 'pepe', WIF: 'dogwifcoin', POL: 'matic-network',
};

interface UseInvestmentAccountsDataParams {
  userId: string;
  onTotalMarketValue?: (value: number, totalCostBasis: number) => void;
  onDistributionData?: (data: InvestmentDistributionData) => void;
}

/**
 * Loads investment accounts + transactions, fetches market prices for holdings,
 * and reports total market value / distribution data to the parent via callbacks.
 *
 * Extracted from `useInvestmentAccounts` — keeps the account/holdings/price data
 * loading concern self-contained while the parent hook composes it with the
 * financial-operation hooks.
 */
export function useInvestmentAccountsData({
  userId,
  onTotalMarketValue,
  onDistributionData,
}: UseInvestmentAccountsDataParams) {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [holdingsMap, setHoldingsMap] = useState<Record<string, Holding[]>>({});
  const [marketPrices, setMarketPrices] = useState<Map<string, MarketPrice>>(new Map());
  const [pricesLoading, setPricesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [rawTransactionsMap, setRawTransactionsMap] = useState<Record<string, RawTransaction[]>>({});

  // ── Data loading ─────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('investment_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading investment accounts:', error);
      toast.error('Errore nel caricamento dei conti');
      return;
    }

    setAccounts(data || []);

    if (data && data.length > 0) {
      const { data: allTxns } = await supabase
        .from('investment_transactions')
        .select('id, investment_account_id, asset_symbol, asset_name, asset_type, transaction_type, quantity, price_per_unit, total_amount, transaction_date')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false });

      const map: Record<string, Holding[]> = {};
      const rawMap: Record<string, RawTransaction[]> = {};

      for (const account of data) {
        const accountTxns = (allTxns || [])
          .filter(t => t.investment_account_id === account.id);

        rawMap[account.id] = accountTxns.map(t => ({
          id: t.id,
          investment_account_id: t.investment_account_id,
          asset_symbol: t.asset_symbol,
          asset_name: t.asset_name,
          asset_type: t.asset_type,
          transaction_type: t.transaction_type as 'buy' | 'sell',
          quantity: Number(t.quantity),
          price_per_unit: Number(t.price_per_unit),
          total_amount: Number(t.total_amount),
          transaction_date: t.transaction_date,
        }));

        const portfolioTxns = accountTxns.map(t => ({
          asset_symbol: t.asset_symbol,
          asset_name: t.asset_name,
          asset_type: t.asset_type,
          transaction_type: t.transaction_type as 'buy' | 'sell',
          quantity: Number(t.quantity),
          price_per_unit: Number(t.price_per_unit),
          total_amount: Number(t.total_amount),
        }));
        map[account.id] = computeHoldings(portfolioTxns);
      }

      setHoldingsMap(map);
      setRawTransactionsMap(rawMap);
    }

    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Fetch market prices when holdings change (exclude manual assets)
  useEffect(() => {
    const allSymbols = new Set<string>();
    const cryptoSymbols = new Set<string>();
    for (const holdings of Object.values(holdingsMap)) {
      for (const h of holdings) {
        if (h.type === 'manual') continue;
        allSymbols.add(h.symbol);
        if (h.type === 'crypto') cryptoSymbols.add(h.symbol);
      }
    }
    if (allSymbols.size === 0) return;

    setPricesLoading(true);

    const loadPrices = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // Build cryptoMap: hardcoded fallback first, then asset_prices_cache for unknowns
      let cryptoMap: Map<string, string> | undefined;
      if (cryptoSymbols.size > 0) {
        cryptoMap = new Map<string, string>();

        for (const symbol of cryptoSymbols) {
          const id = KNOWN_CRYPTO_IDS[symbol];
          if (id) cryptoMap.set(symbol, id);
        }

        // For any crypto not in the hardcoded map, look up from asset_prices_cache
        const unknowns = [...cryptoSymbols].filter(s => !cryptoMap!.has(s));
        if (unknowns.length > 0) {
          const { data: cacheRows } = await supabase
            .from('asset_prices_cache')
            .select('symbol, coingecko_id')
            .in('symbol', unknowns)
            .not('coingecko_id', 'is', null);
          for (const row of cacheRows ?? []) {
            if (row.coingecko_id) cryptoMap.set(row.symbol, row.coingecko_id);
          }
        }

        if (cryptoMap.size === 0) cryptoMap = undefined;
      }

      try {
        const prices = await fetchMarketPrices([...allSymbols], cryptoMap, session?.access_token);
        setMarketPrices(prices);
      } finally {
        setPricesLoading(false);
      }
    };

    loadPrices();
  }, [holdingsMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report total market value to parent
  useEffect(() => {
    if (marketPrices.size === 0 && !pricesLoading) {
      let totalCostBasis = 0;
      for (const holdings of Object.values(holdingsMap)) {
        for (const h of holdings) totalCostBasis += h.costBasis;
      }
      if (totalCostBasis > 0) {
        onTotalMarketValue?.(totalCostBasis, totalCostBasis);
      }
      return;
    }
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    for (const holdings of Object.values(holdingsMap)) {
      for (const h of holdings) {
        const price = marketPrices.get(h.symbol);
        totalMarketValue += h.quantity * (price ? price.priceEur : h.avgPrice);
        totalCostBasis += h.costBasis;
      }
    }
    totalMarketValue = Math.round(totalMarketValue * 100) / 100;
    totalCostBasis = Math.round(totalCostBasis * 100) / 100;
    onTotalMarketValue?.(totalMarketValue, totalCostBasis);

    // Report per-account and per-asset distribution data
    if (onDistributionData) {
      const assetMap = new Map<string, number>();
      const accountValues = accounts.map(acc => {
        let holdingsValue = 0;
        const accHoldings = holdingsMap[acc.id] || [];
        for (const h of accHoldings) {
          const price = marketPrices.get(h.symbol);
          const mv = h.quantity * (price ? price.priceEur : h.avgPrice);
          holdingsValue += mv;
          const assetName = h.name || h.symbol;
          assetMap.set(assetName, (assetMap.get(assetName) || 0) + mv);
        }
        return {
          id: acc.id,
          name: acc.name,
          cashBalance: Number(acc.cash_balance),
          holdingsValue: Math.round(holdingsValue * 100) / 100,
        };
      });
      const assetValues = [...assetMap.entries()].map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
      }));
      onDistributionData({ accountValues, assetValues });
    }
  }, [holdingsMap, marketPrices, pricesLoading, onTotalMarketValue, onDistributionData, accounts]);

  return {
    accounts,
    holdingsMap,
    marketPrices,
    pricesLoading,
    isLoading,
    rawTransactionsMap,
    loadAccounts,
  };
}
