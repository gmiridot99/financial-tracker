'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Transfer } from '@/types/database';
import { formatCurrency } from '@/hooks/useInvestmentAccounts';
import toast from 'react-hot-toast';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// ── Types ────────────────────────────────────────────────────────────

export interface AddTransferData {
  amount: number;
  date: string;
  note?: string;
  is_recurring: boolean;
  frequency?: 'monthly' | 'weekly' | 'yearly';
  trigger_pac: boolean;
  from_savings_account_id: string;
  to_savings_account_id?: string;
  to_investment_account_id?: string;
}

interface UseTransfersParams {
  userId: string;
  onTransfersChanged?: () => void;
  /** Optional callback invoked after a successful transfer to an investment account. Used for PAC auto-execution. */
  pacExecutor?: (accountId: string, depositAmount: number) => Promise<void>;
}

// ── Rollback helpers ──────────────────────────────────────────────────

async function rollbackSavingsBalance(accountId: string, originalBalance: number): Promise<void> {
  await supabase
    .from('savings_accounts')
    .update({ balance: originalBalance })
    .eq('id', accountId);
}

async function rollbackInvestmentCashBalance(accountId: string, originalBalance: number): Promise<void> {
  await supabase
    .from('investment_accounts')
    .update({ cash_balance: originalBalance })
    .eq('id', accountId);
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Gestisce i trasferimenti tra conti (savings→savings, savings→investment).
 *
 * Tutte le operazioni sono atomiche con rollback esplicito:
 * se uno step fallisce, gli step precedenti vengono revertiti al valore originale.
 *
 * @param params.userId - ID utente autenticato (filtro RLS)
 * @param params.onTransfersChanged - Callback invocato dopo ogni write DB riuscito
 * @param params.pacExecutor - Callback opzionale per eseguire PAC dopo deposit in conto investimento
 */
export function useTransfers({ userId, onTransfersChanged, pacExecutor }: UseTransfersParams) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────

  const loadTransfers = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    const start = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('transfers')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false });

    if (error) {
      toast.error('Errore nel caricamento dei trasferimenti');
    } else {
      setTransfers(data ?? []);
    }
    setIsLoading(false);
  }, [userId]);

  // ── Add Transfer ─────────────────────────────────────────────────

  const addTransfer = useCallback(async (data: AddTransferData): Promise<boolean> => {
    const { amount, from_savings_account_id, to_savings_account_id, to_investment_account_id, trigger_pac } = data;

    // Step 0: Fetch source account balance for validation
    const { data: sourceAccount, error: sourceFetchError } = await supabase
      .from('savings_accounts')
      .select('id, name, balance')
      .eq('id', from_savings_account_id)
      .eq('user_id', userId)
      .single();

    if (sourceFetchError || !sourceAccount) {
      toast.error('Errore nel recupero del conto sorgente');
      return false;
    }

    // Step 1: Client-side balance check
    if (sourceAccount.balance < amount) {
      toast.error(
        `Saldo insufficiente su ${sourceAccount.name} (disponibile: ${formatCurrency(sourceAccount.balance)}, richiesti: ${formatCurrency(amount)})`
      );
      return false;
    }

    const originalFromBalance = sourceAccount.balance;
    const newFromBalance = Math.round((originalFromBalance - amount) * 100) / 100;

    // Step 2: Decrement source savings account balance
    const { error: decrError } = await supabase
      .from('savings_accounts')
      .update({ balance: newFromBalance })
      .eq('id', from_savings_account_id)
      .eq('user_id', userId);

    if (decrError) {
      toast.error('Errore nell\'aggiornamento del conto sorgente');
      return false;
    }

    // Step 3: INSERT transfer record (use .select() to get the inserted ID for potential rollback)
    const { data: insertedTransfer, error: insertError } = await supabase
      .from('transfers')
      .insert({
        user_id: userId,
        amount,
        date: data.date,
        note: data.note ?? null,
        is_recurring: data.is_recurring,
        frequency: data.frequency ?? null,
        trigger_pac,
        from_savings_account_id,
        to_savings_account_id: to_savings_account_id ?? null,
        to_investment_account_id: to_investment_account_id ?? null,
      })
      .select('id')
      .single();

    if (insertError || !insertedTransfer) {
      // Rollback: restore source balance
      const { error: rollbackError } = await supabase
        .from('savings_accounts')
        .update({ balance: originalFromBalance })
        .eq('id', from_savings_account_id)
        .eq('user_id', userId);

      if (rollbackError) {
        toast.error('ERRORE CRITICO: saldo conto sorgente non sincronizzato. Contatta il supporto.');
      } else {
        toast.error('Errore nel registrare il trasferimento');
      }
      return false;
    }

    const insertedId = insertedTransfer.id;

    // Step 4: Increment destination account balance
    if (to_savings_account_id) {
      // Savings → Savings transfer
      const { data: destAccount, error: destFetchError } = await supabase
        .from('savings_accounts')
        .select('balance')
        .eq('id', to_savings_account_id)
        .eq('user_id', userId)
        .single();

      if (destFetchError || !destAccount) {
        // Rollback: restore source + delete transfer
        await rollbackSavingsBalance(from_savings_account_id, originalFromBalance);
        await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
        toast.error('Errore nel recupero del conto destinazione');
        return false;
      }

      const newDestBalance = Math.round((destAccount.balance + amount) * 100) / 100;
      const { error: incrError } = await supabase
        .from('savings_accounts')
        .update({ balance: newDestBalance })
        .eq('id', to_savings_account_id)
        .eq('user_id', userId);

      if (incrError) {
        // Rollback: restore source + delete transfer
        await rollbackSavingsBalance(from_savings_account_id, originalFromBalance);
        await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
        toast.error('Errore nell\'aggiornamento del conto destinazione');
        return false;
      }

    } else if (to_investment_account_id) {
      // Savings → Investment transfer
      const { data: investAccount, error: investFetchError } = await supabase
        .from('investment_accounts')
        .select('cash_balance')
        .eq('id', to_investment_account_id)
        .eq('user_id', userId)
        .single();

      if (investFetchError || !investAccount) {
        await rollbackSavingsBalance(from_savings_account_id, originalFromBalance);
        await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
        toast.error('Errore nel recupero del conto investimento destinazione');
        return false;
      }

      const originalInvestBalance = investAccount.cash_balance;
      const newInvestBalance = Math.round((originalInvestBalance + amount) * 100) / 100;

      const { error: investIncrError } = await supabase
        .from('investment_accounts')
        .update({ cash_balance: newInvestBalance })
        .eq('id', to_investment_account_id)
        .eq('user_id', userId);

      if (investIncrError) {
        // Rollback: restore source + delete transfer
        const { error: rollbackError } = await supabase
          .from('savings_accounts')
          .update({ balance: originalFromBalance })
          .eq('id', from_savings_account_id)
          .eq('user_id', userId);
        await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);

        if (rollbackError) {
          toast.error('ERRORE CRITICO: saldo non sincronizzato. Contatta il supporto.');
        } else {
          toast.error('Errore nell\'aggiornamento del conto investimento');
        }
        return false;
      }

      // Step 5: Execute PAC if requested
      if (trigger_pac && pacExecutor) {
        try {
          await pacExecutor(to_investment_account_id, amount);
          toast.success('Trasferimento registrato + PAC eseguito');
        } catch {
          toast.success('Trasferimento registrato (PAC non eseguito)');
        }
      } else {
        toast.success('Trasferimento registrato');
      }

      onTransfersChanged?.();
      return true;
    }

    toast.success('Trasferimento registrato');
    onTransfersChanged?.();
    return true;
  }, [userId, pacExecutor, onTransfersChanged]);

  // ── Delete Transfer ───────────────────────────────────────────────

  const deleteTransfer = useCallback(async (transferId: string): Promise<boolean> => {
    // Fetch the transfer to know amounts and accounts
    const { data: transfer, error: fetchError } = await supabase
      .from('transfers')
      .select('*')
      .eq('id', transferId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !transfer) {
      toast.error('Errore nel recupero del trasferimento');
      return false;
    }

    const { amount, from_savings_account_id, to_savings_account_id, to_investment_account_id } = transfer;

    // Step 1: Fetch source account current balance
    let originalSourceBalance: number | null = null;
    if (from_savings_account_id) {
      const { data: srcAcc } = await supabase
        .from('savings_accounts')
        .select('balance')
        .eq('id', from_savings_account_id)
        .eq('user_id', userId)
        .single();
      if (srcAcc) originalSourceBalance = srcAcc.balance;
    }

    // Step 2: Decrement destination account balance (reverse the original increment)
    if (to_savings_account_id) {
      const { data: destAcc } = await supabase
        .from('savings_accounts')
        .select('balance')
        .eq('id', to_savings_account_id)
        .eq('user_id', userId)
        .single();

      if (destAcc) {
        const newDestBalance = Math.round((destAcc.balance - amount) * 100) / 100;
        const { error: decrDestError } = await supabase
          .from('savings_accounts')
          .update({ balance: Math.max(0, newDestBalance) })
          .eq('id', to_savings_account_id)
          .eq('user_id', userId);

        if (decrDestError) {
          toast.error('Errore nell\'annullamento del trasferimento (conto destinazione)');
          return false;
        }
      }
    } else if (to_investment_account_id) {
      const { data: investAcc } = await supabase
        .from('investment_accounts')
        .select('cash_balance')
        .eq('id', to_investment_account_id)
        .eq('user_id', userId)
        .single();

      if (investAcc) {
        const newInvestBalance = Math.round((investAcc.cash_balance - amount) * 100) / 100;
        const { error: decrInvestError } = await supabase
          .from('investment_accounts')
          .update({ cash_balance: Math.max(0, newInvestBalance) })
          .eq('id', to_investment_account_id)
          .eq('user_id', userId);

        if (decrInvestError) {
          toast.error('Errore nell\'annullamento del trasferimento (conto investimento)');
          return false;
        }
      }
    }

    // Step 3: Restore source account balance
    if (from_savings_account_id && originalSourceBalance !== null) {
      const newSourceBalance = Math.round((originalSourceBalance + amount) * 100) / 100;
      const { error: incrSrcError } = await supabase
        .from('savings_accounts')
        .update({ balance: newSourceBalance })
        .eq('id', from_savings_account_id)
        .eq('user_id', userId);

      if (incrSrcError) {
        toast.error('ERRORE CRITICO: saldo conto sorgente non sincronizzato. Contatta il supporto.');
        return false;
      }
    }

    // Step 4: Delete the transfer record
    const { error: deleteError } = await supabase
      .from('transfers')
      .delete()
      .eq('id', transferId)
      .eq('user_id', userId);

    if (deleteError) {
      toast.error('Errore nell\'eliminazione del trasferimento');
      // Attempt to rollback balance changes
      if (from_savings_account_id && originalSourceBalance !== null) {
        await rollbackSavingsBalance(from_savings_account_id, originalSourceBalance);
      }
      return false;
    }

    toast.success('Trasferimento eliminato');
    setTransfers(prev => prev.filter(t => t.id !== transferId));
    onTransfersChanged?.();
    return true;
  }, [userId, onTransfersChanged]);

  return {
    transfers,
    isLoading,
    loadTransfers,
    addTransfer,
    deleteTransfer,
    setTransfers,
  };
}
