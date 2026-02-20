'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { SavingsAccount } from '@/types/database';
import { parseEuropeanDecimal, formatCurrency } from '@/hooks/useInvestmentAccounts';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────

interface UseSavingsAccountsParams {
  userId: string;
  savingsUnallocated: number;
  onAccountsChanged?: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Gestisce stato, caricamento e operazioni CRUD/finanziarie per i conti risparmio.
 *
 * Side-effects:
 * - Carica i conti da Supabase al mount (e dopo ogni operazione).
 * - Notifica il parent tramite `onAccountsChanged` dopo ogni write DB riuscito.
 *
 * Depositi e trasferimenti sono atomici con rollback esplicito:
 * se lo step 2 fallisce, lo step 1 viene revertito al valore originale.
 *
 * @param params.userId - ID utente autenticato (filtro RLS)
 * @param params.savingsUnallocated - Saldo corrente dei fondi non destinati risparmi
 * @param params.onAccountsChanged - Callback invocato dopo ogni write DB riuscito
 * @returns Stato UI (form, loading), dati (accounts) e action handlers
 */
export function useSavingsAccounts({
  userId,
  savingsUnallocated,
  onAccountsChanged,
}: UseSavingsAccountsParams) {
  // ── Core data ────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Create form ──────────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  // ── Edit name form ───────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // ── Edit balance form ────────────────────────────────────────────
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [editingBalanceValue, setEditingBalanceValue] = useState('');

  // ── Deposit form ─────────────────────────────────────────────────
  const [depositingId, setDepositingId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  // ── Transfer form ────────────────────────────────────────────────
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDestination, setTransferDestination] = useState<string>('');

  // ── Data loading ─────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('savings_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false }) // primary account first
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading savings accounts:', error);
      toast.error('Errore nel caricamento dei conti');
      return;
    }

    setAccounts(data || []);
    setIsLoading(false);
  }, [userId]);

  /** Ensure a primary savings account exists; create "Conto Corrente" if not */
  const ensurePrimaryAccount = useCallback(async () => {
    const { data: existing, error: checkError } = await supabase
      .from('savings_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .limit(1);

    if (checkError) {
      console.error('Error checking primary account:', checkError);
      return;
    }

    if (existing && existing.length > 0) return; // already exists

    const { error: createError } = await supabase
      .from('savings_accounts')
      .insert({ user_id: userId, name: 'Conto Corrente', balance: 0, is_primary: true });

    if (createError) {
      console.error('Error creating primary account:', createError);
    }
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      await ensurePrimaryAccount();
      await loadAccounts();
    };
    init();
  }, [loadAccounts, ensurePrimaryAccount]);

  // ── Rollback helpers ───────────────────────────────────────────────

  /** Attempt to restore a savings account's balance to its original value */
  async function rollbackAccountBalance(accountId: string, originalBalance: number): Promise<boolean> {
    const { error } = await supabase
      .from('savings_accounts')
      .update({ balance: originalBalance })
      .eq('id', accountId)
      .eq('user_id', userId);
    if (error) {
      console.error('CRITICAL: Rollback failed for savings account', accountId, error);
      return false;
    }
    return true;
  }

  /** Attempt to restore unallocated savings balance */
  async function rollbackSavingsUnallocated(originalBalance: number): Promise<boolean> {
    const { error } = await supabase
      .from('unallocated_balances')
      .update({ savings_unallocated: originalBalance })
      .eq('user_id', userId);
    if (error) {
      console.error('CRITICAL: Rollback failed for savings_unallocated', error);
      return false;
    }
    return true;
  }

  // ── CRUD Actions ─────────────────────────────────────────────────

  const handleCreate = async () => {
    const name = newAccountName.trim();
    if (!name) return;

    const { error } = await supabase
      .from('savings_accounts')
      .insert({ user_id: userId, name });

    if (error) {
      console.error('Error creating savings account:', error);
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
      .from('savings_accounts')
      .update({ name })
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating savings account:', error);
      toast.error("Errore nell'aggiornamento del nome");
      return;
    }

    toast.success('Nome aggiornato');
    setEditingId(null);
    setEditingName('');
    await loadAccounts();
  };

  const handleDelete = async (account: SavingsAccount) => {
    if (account.is_primary) {
      toast.error('Il conto principale non può essere eliminato');
      return;
    }
    const { error } = await supabase
      .from('savings_accounts')
      .delete()
      .eq('id', account.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting savings account:', error);
      toast.error("Errore nell'eliminazione del conto");
      return;
    }

    toast.success(`Conto "${account.name}" eliminato`);
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleSetPrimary = async (accountId: string) => {
    const currentPrimary = accounts.find(a => a.is_primary);
    if (!currentPrimary || currentPrimary.id === accountId) return;

    // Step 1: Rimuovi flag primary dall'account corrente
    const { error: step1Error } = await supabase
      .from('savings_accounts')
      .update({ is_primary: false })
      .eq('id', currentPrimary.id)
      .eq('user_id', userId);

    if (step1Error) {
      console.error('Error unsetting primary:', step1Error);
      toast.error('Errore nel cambio conto principale');
      return;
    }

    // Step 2: Imposta il nuovo account come primary
    const { error: step2Error } = await supabase
      .from('savings_accounts')
      .update({ is_primary: true })
      .eq('id', accountId)
      .eq('user_id', userId);

    if (step2Error) {
      console.error('Error setting primary:', step2Error);
      // ROLLBACK Step 1
      const { error: rollbackError } = await supabase
        .from('savings_accounts')
        .update({ is_primary: true })
        .eq('id', currentPrimary.id)
        .eq('user_id', userId);
      if (rollbackError) {
        console.error('CRITICAL: Rollback failed for set-primary', rollbackError);
        toast.error('ERRORE CRITICO: cambio fallito e rollback fallito. Contatta il supporto.');
      } else {
        toast.error('Cambio conto principale fallito. Ripristinato.');
      }
      return;
    }

    const newPrimaryName = accounts.find(a => a.id === accountId)?.name ?? '';
    toast.success(`"${newPrimaryName}" è ora il conto principale`);
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleEditBalance = async (accountId: string) => {
    const value = parseEuropeanDecimal(editingBalanceValue);
    if (isNaN(value) || value < 0) {
      toast.error('Importo non valido (deve essere >= 0)');
      return;
    }
    const newBalance = Math.round(value * 100) / 100;

    const { error } = await supabase
      .from('savings_accounts')
      .update({ balance: newBalance })
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating savings account balance:', error);
      toast.error('Errore nel salvataggio del saldo');
      return;
    }

    toast.success('Saldo aggiornato');
    setEditingBalanceId(null);
    setEditingBalanceValue('');
    await loadAccounts();
    onAccountsChanged?.();
  };

  // ── Atomic Financial Operations (with rollback) ──────────────────

  const handleDeposit = async (account: SavingsAccount) => {
    const amount = parseEuropeanDecimal(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Importo non valido');
      return;
    }
    if (amount > savingsUnallocated) {
      toast.error(`Fondi insufficienti (disponibili: ${formatCurrency(savingsUnallocated)})`);
      return;
    }

    const originalUnallocated = savingsUnallocated;
    const originalBalance = Number(account.balance);

    // Step 1: Decrease savings_unallocated
    const { error: step1Error } = await supabase
      .from('unallocated_balances')
      .update({
        savings_unallocated: Math.round((originalUnallocated - amount) * 100) / 100,
      })
      .eq('user_id', userId);

    if (step1Error) {
      console.error('Error updating unallocated:', step1Error);
      toast.error('Errore nel deposito');
      return;
    }

    // Step 2: Increase account balance
    const { error: step2Error } = await supabase
      .from('savings_accounts')
      .update({
        balance: Math.round((originalBalance + amount) * 100) / 100,
      })
      .eq('id', account.id)
      .eq('user_id', userId);

    if (step2Error) {
      console.error('Error updating account balance:', step2Error);
      // ROLLBACK Step 1
      const rolledBack = await rollbackSavingsUnallocated(originalUnallocated);
      if (rolledBack) {
        toast.error('Deposito fallito. Saldo ripristinato.');
      } else {
        toast.error('ERRORE CRITICO: deposito fallito e rollback fallito. Contatta il supporto.');
      }
      return;
    }

    // Step 3: Create transfer record (non-critical, don't rollback on failure)
    const { error: transferError } = await supabase
      .from('savings_transfers')
      .insert({
        user_id: userId,
        from_account_id: null, // Non destinati
        to_account_id: account.id,
        amount: Math.round(amount * 100) / 100,
      });

    if (transferError) {
      console.error('Error creating transfer record:', transferError);
    }

    toast.success(`Depositati ${formatCurrency(amount)} in ${account.name}`);
    setDepositingId(null);
    setDepositAmount('');
    await loadAccounts();
    onAccountsChanged?.();
  };

  const handleTransfer = async (sourceAccount: SavingsAccount) => {
    const amount = parseEuropeanDecimal(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Importo non valido');
      return;
    }

    const originalSourceBalance = Number(sourceAccount.balance);

    if (amount > originalSourceBalance) {
      toast.error(`Fondi insufficienti (disponibili: ${formatCurrency(originalSourceBalance)})`);
      return;
    }
    if (!transferDestination) {
      toast.error('Seleziona una destinazione');
      return;
    }

    // Step 1: Decrease source balance
    const newSourceBalance = Math.round((originalSourceBalance - amount) * 100) / 100;
    const { error: step1Error } = await supabase
      .from('savings_accounts')
      .update({ balance: newSourceBalance })
      .eq('id', sourceAccount.id)
      .eq('user_id', userId);

    if (step1Error) {
      console.error('Error updating source account:', step1Error);
      toast.error('Errore nel trasferimento');
      return;
    }

    // Step 2: Increase destination (with rollback on failure)
    let destinationName = '';
    let step2Error: unknown = null;

    try {
      if (transferDestination === 'unallocated') {
        destinationName = 'Non destinati';
        const { error } = await supabase
          .from('unallocated_balances')
          .update({
            savings_unallocated: Math.round((savingsUnallocated + amount) * 100) / 100,
          })
          .eq('user_id', userId);
        step2Error = error;
      } else {
        const destAccount = accounts.find(a => a.id === transferDestination);
        if (!destAccount) {
          step2Error = new Error('Conto destinazione non trovato');
        } else {
          destinationName = destAccount.name;
          const { error } = await supabase
            .from('savings_accounts')
            .update({
              balance: Math.round((Number(destAccount.balance) + amount) * 100) / 100,
            })
            .eq('id', destAccount.id)
            .eq('user_id', userId);
          step2Error = error;
        }
      }
    } catch (err) {
      step2Error = err;
    }

    if (step2Error) {
      console.error('Error in transfer destination:', step2Error);
      // ROLLBACK: restore source balance
      const rolledBack = await rollbackAccountBalance(sourceAccount.id, originalSourceBalance);
      if (rolledBack) {
        toast.error('Trasferimento fallito. Il saldo sorgente è stato ripristinato.');
      } else {
        toast.error('ERRORE CRITICO: trasferimento fallito e rollback fallito. Contatta il supporto.');
      }
      return;
    }

    // Step 3: Create transfer record (non-critical)
    const { error: transferError } = await supabase
      .from('savings_transfers')
      .insert({
        user_id: userId,
        from_account_id: sourceAccount.id,
        to_account_id: transferDestination === 'unallocated' ? null : transferDestination,
        amount: Math.round(amount * 100) / 100,
      });

    if (transferError) {
      console.error('Error creating transfer record:', transferError);
    }

    toast.success(`Trasferiti ${formatCurrency(amount)} da ${sourceAccount.name} a ${destinationName}`);
    setTransferringId(null);
    setTransferAmount('');
    setTransferDestination('');
    await loadAccounts();
    onAccountsChanged?.();
  };

  // ── Return ───────────────────────────────────────────────────────

  return {
    // Data
    accounts,
    isLoading,

    // Create form
    showCreateForm, setShowCreateForm,
    newAccountName, setNewAccountName,

    // Edit name form
    editingId, setEditingId,
    editingName, setEditingName,

    // Edit balance form
    editingBalanceId, setEditingBalanceId,
    editingBalanceValue, setEditingBalanceValue,
    handleEditBalance,

    // Deposit form
    depositingId, setDepositingId,
    depositAmount, setDepositAmount,

    // Transfer form
    transferringId, setTransferringId,
    transferAmount, setTransferAmount,
    transferDestination, setTransferDestination,

    // Actions
    handleCreate,
    handleEditName,
    handleDelete,
    handleSetPrimary,
    handleDeposit,
    handleTransfer,

    // Utilities
    formatCurrency,
  };
}
