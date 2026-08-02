import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { InvestmentAccount } from '@/types/database';
import type { Holding } from '@/lib/portfolio';
import { formatCurrency, parseEuropeanDecimal, type OpsCommonDeps } from './types';
import { rollbackCashBalance } from './cashOps';

/** Result of `performAdjustHolding`: 'noop' when nothing changed, 'done' on success, 'error' on failure. */
export type AdjustHoldingResult = 'noop' | 'done' | 'error';

/**
 * Manually adjusts a holding's quantity/average price by inserting a synthetic
 * buy/sell transaction that reconciles the holding to the target values.
 */
export async function performAdjustHolding(
  account: InvestmentAccount,
  holding: Holding,
  rawQty: string,
  rawPrice: string,
  deps: OpsCommonDeps,
): Promise<AdjustHoldingResult> {
  const newQty = parseEuropeanDecimal(rawQty);
  const newPrice = parseEuropeanDecimal(rawPrice);

  if (isNaN(newQty) || newQty < 0) {
    toast.error('Quantità non valida (deve essere >= 0)');
    return 'error';
  }
  if (isNaN(newPrice) || newPrice <= 0) {
    toast.error('Prezzo non valido (deve essere > 0)');
    return 'error';
  }

  const deltaQty = Math.round((newQty - holding.quantity) * 1e8) / 1e8;
  const date = new Date().toISOString().split('T')[0];
  const cashBalance = Number(account.cash_balance);

  if (deltaQty === 0 && Math.abs(newPrice - holding.avgPrice) < 0.001) {
    // Nothing changed
    return 'noop';
  }

  if (deltaQty > 0) {
    // Buy adjustment
    const totalAmount = Math.round(deltaQty * newPrice * 100) / 100;
    const { error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: deps.userId,
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
      return 'error';
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
        user_id: deps.userId,
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
      return 'error';
    }
    // Step 2: Update cash_balance with proceeds
    const { error: step2Error } = await supabase
      .from('investment_accounts')
      .update({ cash_balance: newCashBalance })
      .eq('id', account.id)
      .eq('user_id', deps.userId);
    if (step2Error) {
      // ROLLBACK step 1
      await rollbackCashBalance(deps.userId, account.id, cashBalance);
      toast.error("Aggiustamento fallito. Stato ripristinato.");
      return 'error';
    }
    toast.success(
      `Aggiustamento: -${absDelta % 1 === 0 ? absDelta : absDelta.toFixed(6)} ${holding.symbol} a ${formatCurrency(newPrice)}`
    );
  } else {
    // delta_qty === 0 but price changed: create symbolic buy with qty=0.0001
    const { error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: deps.userId,
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
      return 'error';
    }
    toast.success(`Rettifica prezzo medio ${holding.symbol} a ${formatCurrency(newPrice)}`);
  }

  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return 'done';
}
