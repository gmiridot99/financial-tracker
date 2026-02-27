'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { InvestmentAccount } from '@/types/database';
import type { AssetSearchResult } from '@/components/AssetSearchModal';
import { computeHoldings, type Holding } from '@/lib/portfolio';
import { fetchMarketPrices, type MarketPrice } from '@/lib/market-prices';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────

/** Raw transaction record with ID, used for edit/delete */
export interface RawTransaction {
  id: string;
  investment_account_id: string;
  asset_symbol: string;
  asset_name: string;
  asset_type: string;
  transaction_type: 'buy' | 'sell';
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  transaction_date: string;
}

export interface EditingTransaction {
  id: string;
  accountId: string;
  originalQuantity: number;
  originalPricePerUnit: number;
  originalTotalAmount: number;
  transactionType: 'buy' | 'sell';
  assetSymbol: string;
  quantity: string;
  pricePerUnit: string;
  transactionDate: string;
}

export interface InvestmentDistributionData {
  accountValues: { id: string; name: string; cashBalance: number; holdingsValue: number }[];
  assetValues: { name: string; value: number }[];
}

interface UseInvestmentAccountsParams {
  userId: string;
  onAccountsChanged?: () => void;
  onTotalMarketValue?: (value: number, totalCostBasis: number) => void;
  onDistributionData?: (data: InvestmentDistributionData) => void;
  /** Optional callback invoked after a successful deposit. Used for PAC auto-execution. */
  pacExecutor?: (accountId: string, depositAmount: number) => Promise<void>;
}

// ── Utilities ────────────────────────────────────────────────────────

/** Parses a decimal string accepting both comma and dot as separator (European format). */
export function parseEuropeanDecimal(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

/** Formats a numeric value as EUR currency string in Italian locale (e.g. "1.234,56 €"). */
export function formatCurrency(value: number): string {
  return Number(value).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Gestisce stato, caricamento e operazioni CRUD/finanziarie per i conti investimento.
 *
 * Side-effects:
 * - Carica i conti e le transazioni da Supabase al mount (e dopo ogni operazione).
 * - Fetcha i prezzi di mercato quando le holdings cambiano.
 * - Notifica il parent del market value totale tramite `onTotalMarketValue`.
 *
 * Tutte le operazioni finanziarie (deposito, trasferimento, buy, sell) sono atomiche
 * con rollback esplicito in caso di fallimento parziale.
 *
 * @param params.userId - ID utente autenticato (filtro RLS)
 * @param params.onAccountsChanged - Callback invocato dopo ogni write DB riuscito
 * @param params.onTotalMarketValue - Callback con (marketValue, costBasis) totali del portafoglio
 * @returns Stato UI (form, loading), dati (accounts, holdings, prices) e action handlers
 */
export function useInvestmentAccounts({
  userId,
  onAccountsChanged,
  onTotalMarketValue,
  onDistributionData,
  pacExecutor,
}: UseInvestmentAccountsParams) {
  // ── Core data ────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [holdingsMap, setHoldingsMap] = useState<Record<string, Holding[]>>({});
  const [marketPrices, setMarketPrices] = useState<Map<string, MarketPrice>>(new Map());
  const [pricesLoading, setPricesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [rawTransactionsMap, setRawTransactionsMap] = useState<Record<string, RawTransaction[]>>({});

  // ── Create form ──────────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  // ── Edit name form ───────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // ── Edit cash balance form ───────────────────────────────────────
  const [editingCashBalanceId, setEditingCashBalanceId] = useState<string | null>(null);
  const [editingCashBalanceValue, setEditingCashBalanceValue] = useState('');

  // ── Deposit form ─────────────────────────────────────────────────
  const [depositingId, setDepositingId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  // ── Transfer form ────────────────────────────────────────────────
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDestination, setTransferDestination] = useState<string>('');

  // ── Buy form ─────────────────────────────────────────────────────
  const [buyingAccountId, setBuyingAccountId] = useState<string | null>(null);
  const [showAssetSearch, setShowAssetSearch] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
  const [buyQuantity, setBuyQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Sell form ────────────────────────────────────────────────────
  const [sellingHolding, setSellingHolding] = useState<{ accountId: string; holding: Holding } | null>(null);
  const [sellQuantity, setSellQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellDestination, setSellDestination] = useState<string>('cash');

  // ── Move holding form ────────────────────────────────────────────
  const [movingHolding, setMovingHolding] = useState<{ accountId: string; holding: Holding } | null>(null);
  const [moveQuantity, setMoveQuantity] = useState('');
  const [moveDestination, setMoveDestination] = useState<string>('');

  // ── Transaction edit/delete ──────────────────────────────────────
  const [expandedHolding, setExpandedHolding] = useState<string | null>(null);
  const [editingTxn, setEditingTxn] = useState<EditingTransaction | null>(null);
  const [deletingTxnId, setDeletingTxnId] = useState<string | null>(null);

  // ── Manual holding adjustment ────────────────────────────────────
  /** key: `${accountId}:${symbol}` */
  const [editingHoldingKey, setEditingHoldingKey] = useState<string | null>(null);
  const [editingHoldingQty, setEditingHoldingQty] = useState('');
  const [editingHoldingPrice, setEditingHoldingPrice] = useState('');

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

  // ── Computed values ──────────────────────────────────────────────

  const buyTotal = (() => {
    const q = parseEuropeanDecimal(buyQuantity);
    const p = parseEuropeanDecimal(buyPrice);
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
      return Math.round(q * p * 100) / 100;
    }
    return 0;
  })();

  const sellTotal = (() => {
    const q = parseEuropeanDecimal(sellQuantity);
    const p = parseEuropeanDecimal(sellPrice);
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
      return Math.round(q * p * 100) / 100;
    }
    return 0;
  })();

  const editTotal = (() => {
    if (!editingTxn) return 0;
    const q = parseEuropeanDecimal(editingTxn.quantity);
    const p = parseEuropeanDecimal(editingTxn.pricePerUnit);
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
      return Math.round(q * p * 100) / 100;
    }
    return 0;
  })();

  // ── Rollback helper ──────────────────────────────────────────────

  /** Attempt to restore an investment account's cash_balance to its original value */
  async function rollbackCashBalance(accountId: string, originalBalance: number): Promise<boolean> {
    const { error } = await supabase
      .from('investment_accounts')
      .update({ cash_balance: originalBalance })
      .eq('id', accountId)
      .eq('user_id', userId);
    if (error) {
      console.error('CRITICAL: Rollback failed for account', accountId, error);
      return false;
    }
    return true;
  }

  // ── CRUD Actions ─────────────────────────────────────────────────

  const handleCreate = async () => {
    const name = newAccountName.trim();
    if (!name) return;

    const { error } = await supabase
      .from('investment_accounts')
      .insert({ user_id: userId, name });

    if (error) {
      console.error('Error creating investment account:', error);
      toast.error('Errore nella creazione del conto');
      return;
    }

    toast.success(`Conto "${name}" creato`);
    setNewAccountName('');
    setShowCreateForm(false);
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleEditName = async (accountId: string) => {
    const name = editingName.trim();
    if (!name) return;

    const { error } = await supabase
      .from('investment_accounts')
      .update({ name })
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating investment account:', error);
      toast.error("Errore nell'aggiornamento del nome");
      return;
    }

    toast.success('Nome aggiornato');
    setEditingId(null);
    setEditingName('');
    await loadAccounts();
  };

  const handleDelete = async (account: InvestmentAccount) => {
    // investment_transactions and pac_rules have ON DELETE CASCADE on investment_account_id,
    // so the DB will clean up related data automatically.

    const { error } = await supabase
      .from('investment_accounts')
      .delete()
      .eq('id', account.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting investment account:', error);
      toast.error("Errore nell'eliminazione del conto");
      return;
    }

    toast.success(`Conto "${account.name}" eliminato`);
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleEditCashBalance = async (accountId: string) => {
    const value = parseEuropeanDecimal(editingCashBalanceValue);
    if (isNaN(value) || value < 0) {
      toast.error('Importo non valido (deve essere >= 0)');
      return;
    }
    const newBalance = Math.round(value * 100) / 100;

    const { error } = await supabase
      .from('investment_accounts')
      .update({ cash_balance: newBalance })
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating investment account cash_balance:', error);
      toast.error('Errore nel salvataggio del cash balance');
      return;
    }

    toast.success('Cash balance aggiornato');
    setEditingCashBalanceId(null);
    setEditingCashBalanceValue('');
    await loadAccounts();
    onAccountsChanged?.();
  };

  // ── Atomic Financial Operations (with rollback) ──────────────────

  const handleDeposit = async (account: InvestmentAccount) => {
    const amount = parseEuropeanDecimal(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Importo non valido');
      return;
    }

    const { error } = await supabase
      .from('investment_accounts')
      .update({
        cash_balance: Math.round((Number(account.cash_balance) + amount) * 100) / 100,
      })
      .eq('id', account.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating account cash balance:', error);
      toast.error('Errore nel deposito');
      return;
    }

    toast.success(`Depositati ${formatCurrency(amount)} in ${account.name}`);

    // PAC auto-execution: trigger after successful deposit
    if (pacExecutor) {
      try {
        await pacExecutor(account.id, amount);
      } catch (err) {
        console.error('PAC execution error:', err);
        // PAC failure should not block the deposit - it already succeeded
        toast.error('Errore nell\'esecuzione del PAC automatico');
      }
    }

    setDepositingId(null);
    setDepositAmount('');
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleTransfer = async (sourceAccount: InvestmentAccount) => {
    const amount = parseEuropeanDecimal(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Importo non valido');
      return;
    }

    const originalSourceBalance = Number(sourceAccount.cash_balance);

    if (amount > originalSourceBalance) {
      toast.error(`Fondi insufficienti (disponibili: ${formatCurrency(originalSourceBalance)})`);
      return;
    }
    if (!transferDestination) {
      toast.error('Seleziona una destinazione');
      return;
    }

    // Step 1: Decrease source cash_balance
    const newSourceBalance = Math.round((originalSourceBalance - amount) * 100) / 100;
    const { error: step1Error } = await supabase
      .from('investment_accounts')
      .update({ cash_balance: newSourceBalance })
      .eq('id', sourceAccount.id)
      .eq('user_id', userId);

    if (step1Error) {
      console.error('Error updating source account:', step1Error);
      toast.error('Errore nel trasferimento');
      return;
    }

    // Step 2: Increase destination cash_balance
    const destAccount = accounts.find(a => a.id === transferDestination);
    if (!destAccount) {
      toast.error('Conto destinazione non trovato');
      // ROLLBACK Step 1
      await rollbackCashBalance(sourceAccount.id, originalSourceBalance);
      return;
    }

    const { error: step2Error } = await supabase
      .from('investment_accounts')
      .update({
        cash_balance: Math.round((Number(destAccount.cash_balance) + amount) * 100) / 100,
      })
      .eq('id', destAccount.id)
      .eq('user_id', userId);

    if (step2Error) {
      console.error('Error in transfer destination:', step2Error);
      // ROLLBACK: restore source balance
      const rolledBack = await rollbackCashBalance(sourceAccount.id, originalSourceBalance);
      if (rolledBack) {
        toast.error('Trasferimento fallito. Il saldo sorgente è stato ripristinato.');
      } else {
        toast.error('ERRORE CRITICO: trasferimento fallito e rollback fallito. Contatta il supporto.');
      }
      return;
    }

    toast.success(`Trasferiti ${formatCurrency(amount)} da ${sourceAccount.name} a ${destAccount.name}`);
    setTransferringId(null);
    setTransferAmount('');
    setTransferDestination('');
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleBuy = async (account: InvestmentAccount) => {
    if (!selectedAsset) return;

    const quantity = parseEuropeanDecimal(buyQuantity);
    const pricePerUnit = parseEuropeanDecimal(buyPrice);

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantità non valida');
      return;
    }
    if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
      toast.error('Prezzo non valido');
      return;
    }

    const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
    const originalCashBalance = Number(account.cash_balance);

    if (totalAmount > originalCashBalance) {
      toast.error(`Fondi insufficienti (disponibili: ${formatCurrency(originalCashBalance)})`);
      return;
    }

    // Step 1: Insert investment transaction
    const { error: step1Error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: userId,
        investment_account_id: account.id,
        asset_symbol: selectedAsset.symbol,
        asset_name: selectedAsset.name,
        asset_type: selectedAsset.type === 'index' ? 'stock' : selectedAsset.type,
        transaction_type: 'buy',
        quantity,
        price_per_unit: pricePerUnit,
        total_amount: totalAmount,
        currency: 'EUR',
        transaction_date: buyDate,
      });

    if (step1Error) {
      console.error('Error inserting buy transaction:', step1Error);
      toast.error("Errore nell'acquisto");
      return;
    }

    // Step 2: Decrease cash_balance
    const { error: step2Error } = await supabase
      .from('investment_accounts')
      .update({
        cash_balance: Math.round((originalCashBalance - totalAmount) * 100) / 100,
      })
      .eq('id', account.id)
      .eq('user_id', userId);

    if (step2Error) {
      console.error('Error updating cash balance after buy:', step2Error);
      // ROLLBACK: delete the just-inserted transaction
      // We can't easily get the ID, so we delete by matching fields
      await supabase
        .from('investment_transactions')
        .delete()
        .eq('user_id', userId)
        .eq('investment_account_id', account.id)
        .eq('asset_symbol', selectedAsset.symbol)
        .eq('transaction_date', buyDate)
        .eq('quantity', quantity)
        .eq('price_per_unit', pricePerUnit);

      toast.error("Acquisto fallito. Transazione annullata.");
      return;
    }

    // Persist coingecko_id for future price lookups (fire-and-forget)
    if (selectedAsset.coingecko_id) {
      supabase.from('asset_prices_cache').upsert(
        { symbol: selectedAsset.symbol, coingecko_id: selectedAsset.coingecko_id, asset_type: 'crypto', last_updated: new Date().toISOString() },
        { onConflict: 'symbol' }
      );
    }

    toast.success(`Acquistati ${quantity} ${selectedAsset.symbol} a ${formatCurrency(pricePerUnit)}/unità`);
    setBuyingAccountId(null);
    setSelectedAsset(null);
    setBuyQuantity('');
    setBuyPrice('');
    setBuyDate(new Date().toISOString().split('T')[0]);
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleBuyManual = async (account: InvestmentAccount, assetName: string, rawQuantity: string, rawPrice: string, date: string) => {
    const name = assetName.trim();
    if (!name) {
      toast.error('Inserisci il nome dell\'asset');
      return;
    }

    const quantity = parseEuropeanDecimal(rawQuantity);
    const pricePerUnit = parseEuropeanDecimal(rawPrice);

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantità non valida');
      return;
    }
    if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
      toast.error('Prezzo non valido');
      return;
    }

    const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
    const originalCashBalance = Number(account.cash_balance);

    if (totalAmount > originalCashBalance) {
      toast.error(`Fondi insufficienti (disponibili: ${formatCurrency(originalCashBalance)})`);
      return;
    }

    const symbol = name.substring(0, 20).toUpperCase();

    // Step 1: Insert manual investment transaction
    const { error: step1Error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: userId,
        investment_account_id: account.id,
        asset_symbol: symbol,
        asset_name: name,
        asset_type: 'manual',
        transaction_type: 'buy',
        quantity,
        price_per_unit: pricePerUnit,
        total_amount: totalAmount,
        currency: 'EUR',
        transaction_date: date,
      });

    if (step1Error) {
      console.error('Error inserting manual buy transaction:', step1Error);
      toast.error("Errore nell'acquisto");
      return;
    }

    // Step 2: Decrease cash_balance
    const { error: step2Error } = await supabase
      .from('investment_accounts')
      .update({
        cash_balance: Math.round((originalCashBalance - totalAmount) * 100) / 100,
      })
      .eq('id', account.id)
      .eq('user_id', userId);

    if (step2Error) {
      console.error('Error updating cash balance after manual buy:', step2Error);
      // ROLLBACK: delete the just-inserted transaction
      await supabase
        .from('investment_transactions')
        .delete()
        .eq('user_id', userId)
        .eq('investment_account_id', account.id)
        .eq('asset_symbol', symbol)
        .eq('transaction_date', date)
        .eq('quantity', quantity)
        .eq('price_per_unit', pricePerUnit);

      toast.error("Acquisto fallito. Transazione annullata.");
      return;
    }

    toast.success('Asset aggiunto manualmente');
    setBuyingAccountId(null);
    setBuyQuantity('');
    setBuyPrice('');
    setBuyDate(new Date().toISOString().split('T')[0]);
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleSell = async () => {
    if (!sellingHolding) return;

    const quantity = parseEuropeanDecimal(sellQuantity);
    const pricePerUnit = parseEuropeanDecimal(sellPrice);

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantità non valida');
      return;
    }
    if (quantity > sellingHolding.holding.quantity) {
      toast.error(`Quantità massima: ${sellingHolding.holding.quantity}`);
      return;
    }
    if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
      toast.error('Prezzo non valido');
      return;
    }

    const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
    const account = accounts.find(a => a.id === sellingHolding.accountId);
    if (!account) return;

    const originalCashBalance = Number(account.cash_balance);

    // Step 1: Insert sell transaction
    const { error: step1Error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: userId,
        investment_account_id: sellingHolding.accountId,
        asset_symbol: sellingHolding.holding.symbol,
        asset_name: sellingHolding.holding.name,
        asset_type: sellingHolding.holding.type,
        transaction_type: 'sell',
        quantity,
        price_per_unit: pricePerUnit,
        total_amount: totalAmount,
        currency: 'EUR',
        transaction_date: new Date().toISOString().split('T')[0],
      });

    if (step1Error) {
      console.error('Error inserting sell transaction:', step1Error);
      toast.error('Errore nella vendita');
      return;
    }

    // Step 2: Route proceeds to cash balance
    const { error: step2Error } = await supabase
      .from('investment_accounts')
      .update({
        cash_balance: Math.round((originalCashBalance + totalAmount) * 100) / 100,
      })
      .eq('id', account.id)
      .eq('user_id', userId);

    if (step2Error) {
      console.error('Error routing sell proceeds:', step2Error);
      // ROLLBACK: delete the sell transaction we just inserted
      await supabase
        .from('investment_transactions')
        .delete()
        .eq('user_id', userId)
        .eq('investment_account_id', sellingHolding.accountId)
        .eq('asset_symbol', sellingHolding.holding.symbol)
        .eq('transaction_type', 'sell')
        .eq('quantity', quantity)
        .eq('price_per_unit', pricePerUnit);

      toast.error('Vendita fallita. Transazione annullata.');
      return;
    }

    // Calculate P&L
    const pnl = Math.round((pricePerUnit - sellingHolding.holding.avgPrice) * quantity * 100) / 100;
    const pnlStr = pnl >= 0 ? `+${formatCurrency(pnl)}` : `-${formatCurrency(Math.abs(pnl))}`;

    toast.success(`Venduti ${quantity} ${sellingHolding.holding.symbol} - P&L: ${pnlStr}`);
    setSellingHolding(null);
    setSellQuantity('');
    setSellPrice('');
    setSellDestination('cash');
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleMoveHolding = async () => {
    if (!movingHolding) return;

    const quantity = parseEuropeanDecimal(moveQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantità non valida');
      return;
    }
    if (quantity > movingHolding.holding.quantity) {
      toast.error(`Quantità massima: ${movingHolding.holding.quantity}`);
      return;
    }
    if (!moveDestination) {
      toast.error('Seleziona un conto destinazione');
      return;
    }

    const destAccount = accounts.find(a => a.id === moveDestination);
    if (!destAccount) {
      toast.error('Conto destinazione non trovato');
      return;
    }

    const { holding, accountId: sourceAccountId } = movingHolding;
    const pricePerUnit = holding.avgPrice;
    const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
    const today = new Date().toISOString().split('T')[0];

    // Step 1: INSERT sell in source account (no cash impact)
    const { data: sellData, error: step1Error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: userId,
        investment_account_id: sourceAccountId,
        asset_symbol: holding.symbol,
        asset_name: holding.name,
        asset_type: holding.type,
        transaction_type: 'sell',
        quantity,
        price_per_unit: pricePerUnit,
        total_amount: totalAmount,
        currency: 'EUR',
        transaction_date: today,
      })
      .select('id')
      .single();

    if (step1Error || !sellData) {
      console.error('Error inserting move-sell transaction:', step1Error);
      toast.error('Errore nel trasferimento asset');
      return;
    }

    // Step 2: INSERT buy in destination account (no cash impact)
    const { error: step2Error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: userId,
        investment_account_id: moveDestination,
        asset_symbol: holding.symbol,
        asset_name: holding.name,
        asset_type: holding.type,
        transaction_type: 'buy',
        quantity,
        price_per_unit: pricePerUnit,
        total_amount: totalAmount,
        currency: 'EUR',
        transaction_date: today,
      });

    if (step2Error) {
      console.error('Error inserting move-buy transaction:', step2Error);
      // ROLLBACK: delete the sell we just inserted
      await supabase
        .from('investment_transactions')
        .delete()
        .eq('id', sellData.id)
        .eq('user_id', userId);
      toast.error('Trasferimento fallito. Operazione annullata.');
      return;
    }

    const qtyStr = quantity % 1 === 0 ? String(quantity) : quantity.toFixed(6);
    toast.success(`Spostati ${qtyStr} ${holding.symbol} in ${destAccount.name}`);
    setMovingHolding(null);
    setMoveQuantity('');
    setMoveDestination('');
    await loadAccounts();
    onAccountsChanged?.();
  };

  // ── Transaction edit/delete ──────────────────────────────────────

  const startEditTransaction = (txn: RawTransaction, accountId: string) => {
    setEditingTxn({
      id: txn.id,
      accountId,
      originalQuantity: txn.quantity,
      originalPricePerUnit: txn.price_per_unit,
      originalTotalAmount: txn.total_amount,
      transactionType: txn.transaction_type,
      assetSymbol: txn.asset_symbol,
      quantity: txn.quantity.toString().replace('.', ','),
      pricePerUnit: txn.price_per_unit.toString().replace('.', ','),
      transactionDate: txn.transaction_date,
    });
    setDeletingTxnId(null);
  };

  const handleEditTransaction = async () => {
    if (!editingTxn) return;

    const quantity = parseEuropeanDecimal(editingTxn.quantity);
    const pricePerUnit = parseEuropeanDecimal(editingTxn.pricePerUnit);

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantita non valida');
      return;
    }
    if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
      toast.error('Prezzo non valido');
      return;
    }

    const newTotalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
    const oldTotalAmount = editingTxn.originalTotalAmount;
    const difference = Math.round((newTotalAmount - oldTotalAmount) * 100) / 100;

    const account = accounts.find(a => a.id === editingTxn.accountId);
    if (!account) return;

    const originalCashBalance = Number(account.cash_balance);

    let newCashBalance: number;
    if (editingTxn.transactionType === 'buy') {
      newCashBalance = Math.round((originalCashBalance - difference) * 100) / 100;
      if (newCashBalance < 0) {
        toast.error(`Fondi insufficienti. Differenza: ${formatCurrency(difference)}, disponibili: ${formatCurrency(originalCashBalance)}`);
        return;
      }
    } else {
      newCashBalance = Math.round((originalCashBalance + difference) * 100) / 100;
    }

    // Step 1: Update the transaction
    const { error: step1Error } = await supabase
      .from('investment_transactions')
      .update({
        quantity,
        price_per_unit: pricePerUnit,
        total_amount: newTotalAmount,
        transaction_date: editingTxn.transactionDate,
      })
      .eq('id', editingTxn.id)
      .eq('user_id', userId);

    if (step1Error) {
      console.error('Error updating transaction:', step1Error);
      toast.error('Errore nella modifica della transazione');
      return;
    }

    // Step 2: Update cash balance
    const { error: step2Error } = await supabase
      .from('investment_accounts')
      .update({ cash_balance: newCashBalance })
      .eq('id', editingTxn.accountId)
      .eq('user_id', userId);

    if (step2Error) {
      console.error('Error updating cash balance:', step2Error);
      // ROLLBACK: revert the transaction to original values
      await supabase
        .from('investment_transactions')
        .update({
          quantity: editingTxn.originalQuantity,
          price_per_unit: editingTxn.originalPricePerUnit,
          total_amount: editingTxn.originalTotalAmount,
        })
        .eq('id', editingTxn.id)
        .eq('user_id', userId);

      toast.error('Modifica fallita. Transazione ripristinata.');
      return;
    }

    toast.success('Transazione modificata');
    setEditingTxn(null);
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleDeleteTransaction = async (txn: RawTransaction) => {
    const account = accounts.find(a => a.id === txn.investment_account_id);
    if (!account) return;

    const originalCashBalance = Number(account.cash_balance);

    let newCashBalance: number;
    if (txn.transaction_type === 'buy') {
      newCashBalance = Math.round((originalCashBalance + txn.total_amount) * 100) / 100;
    } else {
      newCashBalance = Math.round((originalCashBalance - txn.total_amount) * 100) / 100;
    }

    // Step 1: Delete the transaction
    const { error: step1Error } = await supabase
      .from('investment_transactions')
      .delete()
      .eq('id', txn.id)
      .eq('user_id', userId);

    if (step1Error) {
      console.error('Error deleting transaction:', step1Error);
      toast.error("Errore nell'eliminazione della transazione");
      return;
    }

    // Step 2: Update cash balance
    const { error: step2Error } = await supabase
      .from('investment_accounts')
      .update({ cash_balance: newCashBalance })
      .eq('id', txn.investment_account_id)
      .eq('user_id', userId);

    if (step2Error) {
      console.error('Error updating cash balance after delete:', step2Error);
      // ROLLBACK: re-insert the deleted transaction
      await supabase
        .from('investment_transactions')
        .insert({
          id: txn.id,
          user_id: userId,
          investment_account_id: txn.investment_account_id,
          asset_symbol: txn.asset_symbol,
          asset_name: txn.asset_name,
          asset_type: txn.asset_type,
          transaction_type: txn.transaction_type,
          quantity: txn.quantity,
          price_per_unit: txn.price_per_unit,
          total_amount: txn.total_amount,
          transaction_date: txn.transaction_date,
        });

      toast.error('Eliminazione fallita. Transazione ripristinata.');
      return;
    }

    toast.success('Transazione eliminata');
    setDeletingTxnId(null);
    setEditingTxn(null);
    await loadAccounts();
    onAccountsChanged?.();
  };

  // ── Manual holding adjustment ────────────────────────────────────

  const handleAdjustHolding = async (
    account: InvestmentAccount,
    holding: Holding,
  ) => {
    const newQty = parseEuropeanDecimal(editingHoldingQty);
    const newPrice = parseEuropeanDecimal(editingHoldingPrice);

    if (isNaN(newQty) || newQty < 0) {
      toast.error('Quantità non valida (deve essere >= 0)');
      return;
    }
    if (isNaN(newPrice) || newPrice <= 0) {
      toast.error('Prezzo non valido (deve essere > 0)');
      return;
    }

    const deltaQty = Math.round((newQty - holding.quantity) * 1e8) / 1e8;
    const date = new Date().toISOString().split('T')[0];
    const cashBalance = Number(account.cash_balance);

    if (deltaQty === 0 && Math.abs(newPrice - holding.avgPrice) < 0.001) {
      // Nothing changed
      setEditingHoldingKey(null);
      return;
    }

    if (deltaQty > 0) {
      // Buy adjustment
      const totalAmount = Math.round(deltaQty * newPrice * 100) / 100;
      const { error } = await supabase
        .from('investment_transactions')
        .insert({
          user_id: userId,
          investment_account_id: account.id,
          asset_symbol: holding.symbol,
          asset_name: holding.name,
          asset_type: holding.type,
          transaction_type: 'buy',
          quantity: deltaQty,
          price_per_unit: newPrice,
          total_amount: totalAmount,
          currency: 'EUR',
          transaction_date: date,
        });
      if (error) {
        toast.error("Errore nell'aggiustamento");
        return;
      }
      toast.success(
        `Aggiustamento: +${deltaQty % 1 === 0 ? deltaQty : deltaQty.toFixed(6)} ${holding.symbol} a ${formatCurrency(newPrice)}`
      );
    } else if (deltaQty < 0) {
      // Sell adjustment
      const absDelta = Math.abs(deltaQty);
      const totalAmount = Math.round(absDelta * newPrice * 100) / 100;
      const newCashBalance = Math.round((cashBalance + totalAmount) * 100) / 100;

      // Step 1: Insert sell transaction
      const { error: step1Error } = await supabase
        .from('investment_transactions')
        .insert({
          user_id: userId,
          investment_account_id: account.id,
          asset_symbol: holding.symbol,
          asset_name: holding.name,
          asset_type: holding.type,
          transaction_type: 'sell',
          quantity: absDelta,
          price_per_unit: newPrice,
          total_amount: totalAmount,
          currency: 'EUR',
          transaction_date: date,
        });
      if (step1Error) {
        toast.error("Errore nell'aggiustamento");
        return;
      }
      // Step 2: Update cash_balance with proceeds
      const { error: step2Error } = await supabase
        .from('investment_accounts')
        .update({ cash_balance: newCashBalance })
        .eq('id', account.id)
        .eq('user_id', userId);
      if (step2Error) {
        // ROLLBACK step 1
        await rollbackCashBalance(account.id, cashBalance);
        toast.error("Aggiustamento fallito. Stato ripristinato.");
        return;
      }
      toast.success(
        `Aggiustamento: -${absDelta % 1 === 0 ? absDelta : absDelta.toFixed(6)} ${holding.symbol} a ${formatCurrency(newPrice)}`
      );
    } else {
      // delta_qty === 0 but price changed: create symbolic buy with qty=0.0001
      const { error } = await supabase
        .from('investment_transactions')
        .insert({
          user_id: userId,
          investment_account_id: account.id,
          asset_symbol: holding.symbol,
          asset_name: holding.name,
          asset_type: holding.type,
          transaction_type: 'buy',
          quantity: 0.0001,
          price_per_unit: newPrice,
          total_amount: Math.round(0.0001 * newPrice * 100) / 100,
          currency: 'EUR',
          transaction_date: date,
        });
      if (error) {
        toast.error('Errore nella rettifica del prezzo medio');
        return;
      }
      toast.success(`Rettifica prezzo medio ${holding.symbol} a ${formatCurrency(newPrice)}`);
    }

    setEditingHoldingKey(null);
    setEditingHoldingQty('');
    setEditingHoldingPrice('');
    await loadAccounts();
    onAccountsChanged?.();
  };

  // ── Return ───────────────────────────────────────────────────────

  return {
    // Data
    accounts,
    holdingsMap,
    marketPrices,
    rawTransactionsMap,
    pricesLoading,
    isLoading,

    // Create form
    showCreateForm, setShowCreateForm,
    newAccountName, setNewAccountName,

    // Edit name form
    editingId, setEditingId,
    editingName, setEditingName,

    // Edit cash balance form
    editingCashBalanceId, setEditingCashBalanceId,
    editingCashBalanceValue, setEditingCashBalanceValue,
    handleEditCashBalance,

    // Deposit form
    depositingId, setDepositingId,
    depositAmount, setDepositAmount,

    // Transfer form
    transferringId, setTransferringId,
    transferAmount, setTransferAmount,
    transferDestination, setTransferDestination,

    // Buy form
    buyingAccountId, setBuyingAccountId,
    showAssetSearch, setShowAssetSearch,
    selectedAsset, setSelectedAsset,
    buyQuantity, setBuyQuantity,
    buyPrice, setBuyPrice,
    buyDate, setBuyDate,

    // Sell form
    sellingHolding, setSellingHolding,
    sellQuantity, setSellQuantity,
    sellPrice, setSellPrice,
    sellDestination, setSellDestination,

    // Move holding form
    movingHolding, setMovingHolding,
    moveQuantity, setMoveQuantity,
    moveDestination, setMoveDestination,
    handleMoveHolding,

    // Transaction edit/delete
    expandedHolding, setExpandedHolding,
    editingTxn, setEditingTxn,
    deletingTxnId, setDeletingTxnId,

    // Manual holding adjustment
    editingHoldingKey, setEditingHoldingKey,
    editingHoldingQty, setEditingHoldingQty,
    editingHoldingPrice, setEditingHoldingPrice,
    handleAdjustHolding,

    // Computed
    buyTotal,
    sellTotal,
    editTotal,

    // Actions
    handleCreate,
    handleEditName,
    handleDelete,
    handleDeposit,
    handleTransfer,
    handleBuy,
    handleBuyManual,
    handleSell,
    startEditTransaction,
    handleEditTransaction,
    handleDeleteTransaction,

    // Utilities
    formatCurrency,
  };
}
