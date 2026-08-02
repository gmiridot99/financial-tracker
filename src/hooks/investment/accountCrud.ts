import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { InvestmentAccount } from '@/types/database';
import { parseEuropeanDecimal, type OpsCommonDeps } from './types';

/** Creates a new investment account. Returns true on success. */
export async function createAccount(name: string, deps: OpsCommonDeps): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;

  const { error } = await supabase
    .from('investment_accounts')
    .insert({ user_id: deps.userId, name: trimmed });

  if (error) {
    console.error('Error creating investment account:', error);
    toast.error('Errore nella creazione del conto');
    return false;
  }

  toast.success(`Conto "${trimmed}" creato`);
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}

/** Renames an investment account. Returns true on success. */
export async function editAccountName(accountId: string, name: string, deps: OpsCommonDeps): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;

  const { error } = await supabase
    .from('investment_accounts')
    .update({ name: trimmed })
    .eq('id', accountId)
    .eq('user_id', deps.userId);

  if (error) {
    console.error('Error updating investment account:', error);
    toast.error("Errore nell'aggiornamento del nome");
    return false;
  }

  toast.success('Nome aggiornato');
  await deps.loadAccounts();
  return true;
}

/** Deletes an investment account (transactions/pac_rules cascade via DB FK). Returns true on success. */
export async function deleteAccount(account: InvestmentAccount, deps: OpsCommonDeps): Promise<boolean> {
  const { error } = await supabase
    .from('investment_accounts')
    .delete()
    .eq('id', account.id)
    .eq('user_id', deps.userId);

  if (error) {
    console.error('Error deleting investment account:', error);
    toast.error("Errore nell'eliminazione del conto");
    return false;
  }

  toast.success(`Conto "${account.name}" eliminato`);
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}

/** Manually overrides an account's cash_balance. Returns true on success. */
export async function editCashBalance(accountId: string, rawValue: string, deps: OpsCommonDeps): Promise<boolean> {
  const value = parseEuropeanDecimal(rawValue);
  if (isNaN(value) || value < 0) {
    toast.error('Importo non valido (deve essere >= 0)');
    return false;
  }
  const newBalance = Math.round(value * 100) / 100;

  const { error } = await supabase
    .from('investment_accounts')
    .update({ cash_balance: newBalance })
    .eq('id', accountId)
    .eq('user_id', deps.userId);

  if (error) {
    console.error('Error updating investment account cash_balance:', error);
    toast.error('Errore nel salvataggio del cash balance');
    return false;
  }

  toast.success('Cash balance aggiornato');
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}
