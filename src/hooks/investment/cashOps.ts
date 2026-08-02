import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { InvestmentAccount } from '@/types/database';
import { formatCurrency, parseEuropeanDecimal, type OpsCommonDeps } from './types';

/** Attempt to restore an investment account's cash_balance to its original value */
export async function rollbackCashBalance(userId: string, accountId: string, originalBalance: number): Promise<boolean> {
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

export interface DepositDeps extends OpsCommonDeps {
  pacExecutor?: (accountId: string, depositAmount: number) => Promise<void>;
}

/** Deposits cash into an investment account, then optionally triggers PAC auto-execution. Returns true on success. */
export async function performDeposit(
  account: InvestmentAccount,
  rawAmount: string,
  deps: DepositDeps,
): Promise<boolean> {
  const amount = parseEuropeanDecimal(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    toast.error('Importo non valido');
    return false;
  }

  const { error } = await supabase
    .from('investment_accounts')
    .update({
      cash_balance: Math.round((Number(account.cash_balance) + amount) * 100) / 100,
    })
    .eq('id', account.id)
    .eq('user_id', deps.userId);

  if (error) {
    console.error('Error updating account cash balance:', error);
    toast.error('Errore nel deposito');
    return false;
  }

  toast.success(`Depositati ${formatCurrency(amount)} in ${account.name}`);

  // PAC auto-execution: trigger after successful deposit
  if (deps.pacExecutor) {
    try {
      await deps.pacExecutor(account.id, amount);
    } catch (err) {
      console.error('PAC execution error:', err);
      // PAC failure should not block the deposit - it already succeeded
      toast.error('Errore nell\'esecuzione del PAC automatico');
    }
  }

  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}

/** Transfers cash between two investment accounts with tracked rollback on partial failure. Returns true on success. */
export async function performTransfer(
  sourceAccount: InvestmentAccount,
  rawAmount: string,
  destinationId: string,
  accounts: InvestmentAccount[],
  deps: OpsCommonDeps,
): Promise<boolean> {
  const amount = parseEuropeanDecimal(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    toast.error('Importo non valido');
    return false;
  }

  const originalSourceBalance = Number(sourceAccount.cash_balance);

  if (amount > originalSourceBalance) {
    toast.error(`Fondi insufficienti (disponibili: ${formatCurrency(originalSourceBalance)})`);
    return false;
  }
  if (!destinationId) {
    toast.error('Seleziona una destinazione');
    return false;
  }

  // Step 1: Decrease source cash_balance
  const newSourceBalance = Math.round((originalSourceBalance - amount) * 100) / 100;
  const { error: step1Error } = await supabase
    .from('investment_accounts')
    .update({ cash_balance: newSourceBalance })
    .eq('id', sourceAccount.id)
    .eq('user_id', deps.userId);

  if (step1Error) {
    console.error('Error updating source account:', step1Error);
    toast.error('Errore nel trasferimento');
    return false;
  }

  // Step 2: Increase destination cash_balance
  const destAccount = accounts.find(a => a.id === destinationId);
  if (!destAccount) {
    toast.error('Conto destinazione non trovato');
    // ROLLBACK Step 1
    await rollbackCashBalance(deps.userId, sourceAccount.id, originalSourceBalance);
    return false;
  }

  const { error: step2Error } = await supabase
    .from('investment_accounts')
    .update({
      cash_balance: Math.round((Number(destAccount.cash_balance) + amount) * 100) / 100,
    })
    .eq('id', destAccount.id)
    .eq('user_id', deps.userId);

  if (step2Error) {
    console.error('Error in transfer destination:', step2Error);
    // ROLLBACK: restore source balance
    const rolledBack = await rollbackCashBalance(deps.userId, sourceAccount.id, originalSourceBalance);
    if (rolledBack) {
      toast.error('Trasferimento fallito. Il saldo sorgente è stato ripristinato.');
    } else {
      toast.error('ERRORE CRITICO: trasferimento fallito e rollback fallito. Contatta il supporto.');
    }
    return false;
  }

  toast.success(`Trasferiti ${formatCurrency(amount)} da ${sourceAccount.name} a ${destAccount.name}`);
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}
