'use client';

import { useState } from 'react';
import type { InvestmentAccount } from '@/types/database';
import type { AssetSearchResult } from '@/components/AssetSearchModal';
import type { Holding } from '@/lib/portfolio';
import { useInvestmentAccountsData } from '@/hooks/investment/useInvestmentAccountsData';
import { createAccount, editAccountName, deleteAccount, editCashBalance } from '@/hooks/investment/accountCrud';
import { performDeposit, performTransfer } from '@/hooks/investment/cashOps';
import { performBuy, performBuyManual, performSell, performMoveHolding } from '@/hooks/investment/tradeOps';
import { performEditTransaction, performDeleteTransaction } from '@/hooks/investment/transactionOps';
import { performAdjustHolding } from '@/hooks/investment/holdingAdjustOps';
import {
  parseEuropeanDecimal,
  formatCurrency,
  type EditingTransaction,
  type InvestmentDistributionData,
  type OpsCommonDeps,
  type RawTransaction,
  type UseInvestmentAccountsParams,
} from '@/hooks/investment/types';

// Re-exported for existing callers (`@/hooks/useInvestmentAccounts` is the established import path).
export { parseEuropeanDecimal, formatCurrency };
export type { RawTransaction, EditingTransaction, InvestmentDistributionData };

/**
 * Gestisce stato, caricamento e operazioni CRUD/finanziarie per i conti investimento.
 *
 * Side-effects:
 * - Carica i conti e le transazioni da Supabase al mount (e dopo ogni operazione).
 * - Fetcha i prezzi di mercato quando le holdings cambiano.
 * - Notifica il parent del market value totale tramite `onTotalMarketValue`.
 *
 * Tutte le operazioni finanziarie (deposito, trasferimento, buy, sell) sono atomiche
 * con rollback esplicito in caso di fallimento parziale. Ogni operazione vive in un
 * modulo dedicato sotto `src/hooks/investment/` — questo hook le compone e gestisce
 * solo lo stato dei form UI.
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
  // ── Core data (accounts, holdings, prices) ────────────────────────
  const {
    accounts,
    holdingsMap,
    marketPrices,
    pricesLoading,
    isLoading,
    rawTransactionsMap,
    loadAccounts,
  } = useInvestmentAccountsData({ userId, onTotalMarketValue, onDistributionData });

  const commonDeps: OpsCommonDeps = { userId, loadAccounts, onAccountsChanged };

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

  // ── CRUD Actions ─────────────────────────────────────────────────

  const handleCreate = async () => {
    const ok = await createAccount(newAccountName, commonDeps);
    if (ok) {
      setNewAccountName('');
      setShowCreateForm(false);
    }
  };

  const handleEditName = async (accountId: string) => {
    const ok = await editAccountName(accountId, editingName, commonDeps);
    if (ok) {
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleDelete = async (account: InvestmentAccount) => {
    await deleteAccount(account, commonDeps);
  };

  const handleEditCashBalance = async (accountId: string) => {
    const ok = await editCashBalance(accountId, editingCashBalanceValue, commonDeps);
    if (ok) {
      setEditingCashBalanceId(null);
      setEditingCashBalanceValue('');
    }
  };

  // ── Atomic Financial Operations (with rollback) ──────────────────

  const handleDeposit = async (account: InvestmentAccount) => {
    const ok = await performDeposit(account, depositAmount, { ...commonDeps, pacExecutor });
    if (ok) {
      setDepositingId(null);
      setDepositAmount('');
    }
  };

  const handleTransfer = async (sourceAccount: InvestmentAccount) => {
    const ok = await performTransfer(sourceAccount, transferAmount, transferDestination, accounts, commonDeps);
    if (ok) {
      setTransferringId(null);
      setTransferAmount('');
      setTransferDestination('');
    }
  };

  const handleBuy = async (account: InvestmentAccount) => {
    if (!selectedAsset) return;
    const ok = await performBuy(account, selectedAsset, buyQuantity, buyPrice, buyDate, commonDeps);
    if (ok) {
      setBuyingAccountId(null);
      setSelectedAsset(null);
      setBuyQuantity('');
      setBuyPrice('');
      setBuyDate(new Date().toISOString().split('T')[0]);
    }
  };

  const handleBuyManual = async (account: InvestmentAccount, assetName: string, rawQuantity: string, rawPrice: string, date: string) => {
    const ok = await performBuyManual(account, assetName, rawQuantity, rawPrice, date, commonDeps);
    if (ok) {
      setBuyingAccountId(null);
      setBuyQuantity('');
      setBuyPrice('');
      setBuyDate(new Date().toISOString().split('T')[0]);
    }
  };

  const handleSell = async () => {
    if (!sellingHolding) return;
    const ok = await performSell(sellingHolding, sellQuantity, sellPrice, accounts, commonDeps);
    if (ok) {
      setSellingHolding(null);
      setSellQuantity('');
      setSellPrice('');
      setSellDestination('cash');
    }
  };

  const handleMoveHolding = async () => {
    if (!movingHolding) return;
    const ok = await performMoveHolding(movingHolding, moveQuantity, moveDestination, accounts, commonDeps);
    if (ok) {
      setMovingHolding(null);
      setMoveQuantity('');
      setMoveDestination('');
    }
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
    const ok = await performEditTransaction(editingTxn, accounts, commonDeps);
    if (ok) {
      setEditingTxn(null);
    }
  };

  const handleDeleteTransaction = async (txn: RawTransaction) => {
    const ok = await performDeleteTransaction(txn, accounts, commonDeps);
    if (ok) {
      setDeletingTxnId(null);
      setEditingTxn(null);
    }
  };

  // ── Manual holding adjustment ────────────────────────────────────

  const handleAdjustHolding = async (
    account: InvestmentAccount,
    holding: Holding,
  ) => {
    const result = await performAdjustHolding(account, holding, editingHoldingQty, editingHoldingPrice, commonDeps);
    if (result === 'noop') {
      setEditingHoldingKey(null);
      return;
    }
    if (result === 'done') {
      setEditingHoldingKey(null);
      setEditingHoldingQty('');
      setEditingHoldingPrice('');
    }
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
