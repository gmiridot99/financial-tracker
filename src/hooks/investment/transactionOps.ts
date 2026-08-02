import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { InvestmentAccount } from '@/types/database';
import { formatCurrency, parseEuropeanDecimal, type EditingTransaction, type OpsCommonDeps, type RawTransaction } from './types';

/** Edits an existing buy/sell transaction and adjusts the account's cash_balance by the difference. Returns true on success. */
export async function performEditTransaction(
  editingTxn: EditingTransaction,
  accounts: InvestmentAccount[],
  deps: OpsCommonDeps,
): Promise<boolean> {
  const quantity = parseEuropeanDecimal(editingTxn.quantity);
  const pricePerUnit = parseEuropeanDecimal(editingTxn.pricePerUnit);

  if (isNaN(quantity) || quantity <= 0) {
    toast.error('Quantita non valida');
    return false;
  }
  if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
    toast.error('Prezzo non valido');
    return false;
  }

  const newTotalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
  const oldTotalAmount = editingTxn.originalTotalAmount;
  const difference = Math.round((newTotalAmount - oldTotalAmount) * 100) / 100;

  const account = accounts.find(a => a.id === editingTxn.accountId);
  if (!account) return false;

  const originalCashBalance = Number(account.cash_balance);

  let newCashBalance: number;
  if (editingTxn.transactionType === 'buy') {
    newCashBalance = Math.round((originalCashBalance - difference) * 100) / 100;
    if (newCashBalance < 0) {
      toast.error(`Fondi insufficienti. Differenza: ${formatCurrency(difference)}, disponibili: ${formatCurrency(originalCashBalance)}`);
      return false;
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
    .eq('user_id', deps.userId);

  if (step1Error) {
    console.error('Error updating transaction:', step1Error);
    toast.error('Errore nella modifica della transazione');
    return false;
  }

  // Step 2: Update cash balance
  const { error: step2Error } = await supabase
    .from('investment_accounts')
    .update({ cash_balance: newCashBalance })
    .eq('id', editingTxn.accountId)
    .eq('user_id', deps.userId);

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
      .eq('user_id', deps.userId);

    toast.error('Modifica fallita. Transazione ripristinata.');
    return false;
  }

  toast.success('Transazione modificata');
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}

/** Deletes a transaction and reverses its cash_balance impact, with rollback (re-insert) on failure. Returns true on success. */
export async function performDeleteTransaction(
  txn: RawTransaction,
  accounts: InvestmentAccount[],
  deps: OpsCommonDeps,
): Promise<boolean> {
  const account = accounts.find(a => a.id === txn.investment_account_id);
  if (!account) return false;

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
    .eq('user_id', deps.userId);

  if (step1Error) {
    console.error('Error deleting transaction:', step1Error);
    toast.error("Errore nell'eliminazione della transazione");
    return false;
  }

  // Step 2: Update cash balance
  const { error: step2Error } = await supabase
    .from('investment_accounts')
    .update({ cash_balance: newCashBalance })
    .eq('id', txn.investment_account_id)
    .eq('user_id', deps.userId);

  if (step2Error) {
    console.error('Error updating cash balance after delete:', step2Error);
    // ROLLBACK: re-insert the deleted transaction
    await supabase
      .from('investment_transactions')
      .insert({
        id: txn.id,
        user_id: deps.userId,
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
    return false;
  }

  toast.success('Transazione eliminata');
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}
