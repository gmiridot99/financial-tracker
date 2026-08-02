import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { InvestmentAccount } from '@/types/database';
import type { AssetSearchResult } from '@/components/AssetSearchModal';
import type { Holding } from '@/lib/portfolio';
import { formatCurrency, parseEuropeanDecimal, type OpsCommonDeps } from './types';

/** Buys a market asset (from asset search) into an account's portfolio, debiting cash_balance. Returns true on success. */
export async function performBuy(
  account: InvestmentAccount,
  selectedAsset: AssetSearchResult,
  rawQuantity: string,
  rawPrice: string,
  buyDate: string,
  deps: OpsCommonDeps,
): Promise<boolean> {
  const quantity = parseEuropeanDecimal(rawQuantity);
  const pricePerUnit = parseEuropeanDecimal(rawPrice);

  if (isNaN(quantity) || quantity <= 0) {
    toast.error('Quantità non valida');
    return false;
  }
  if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
    toast.error('Prezzo non valido');
    return false;
  }

  const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
  const originalCashBalance = Number(account.cash_balance);

  if (totalAmount > originalCashBalance) {
    toast.error(`Fondi insufficienti (disponibili: ${formatCurrency(originalCashBalance)})`);
    return false;
  }

  // Step 1: Insert investment transaction
  const { error: step1Error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: deps.userId,
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
    return false;
  }

  // Step 2: Decrease cash_balance
  const { error: step2Error } = await supabase
    .from('investment_accounts')
    .update({
      cash_balance: Math.round((originalCashBalance - totalAmount) * 100) / 100,
    })
    .eq('id', account.id)
    .eq('user_id', deps.userId);

  if (step2Error) {
    console.error('Error updating cash balance after buy:', step2Error);
    // ROLLBACK: delete the just-inserted transaction
    // We can't easily get the ID, so we delete by matching fields
    await supabase
      .from('investment_transactions')
      .delete()
      .eq('user_id', deps.userId)
      .eq('investment_account_id', account.id)
      .eq('asset_symbol', selectedAsset.symbol)
      .eq('transaction_date', buyDate)
      .eq('quantity', quantity)
      .eq('price_per_unit', pricePerUnit);

    toast.error("Acquisto fallito. Transazione annullata.");
    return false;
  }

  // Persist coingecko_id for future price lookups (fire-and-forget)
  if (selectedAsset.coingecko_id) {
    supabase.from('asset_prices_cache').upsert(
      { symbol: selectedAsset.symbol, coingecko_id: selectedAsset.coingecko_id, asset_type: 'crypto', last_updated: new Date().toISOString() },
      { onConflict: 'symbol' }
    );
  }

  toast.success(`Acquistati ${quantity} ${selectedAsset.symbol} a ${formatCurrency(pricePerUnit)}/unità`);
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}

/** Buys a manually-entered asset (no market lookup) into an account's portfolio, debiting cash_balance. Returns true on success. */
export async function performBuyManual(
  account: InvestmentAccount,
  assetName: string,
  rawQuantity: string,
  rawPrice: string,
  date: string,
  deps: OpsCommonDeps,
): Promise<boolean> {
  const name = assetName.trim();
  if (!name) {
    toast.error('Inserisci il nome dell\'asset');
    return false;
  }

  const quantity = parseEuropeanDecimal(rawQuantity);
  const pricePerUnit = parseEuropeanDecimal(rawPrice);

  if (isNaN(quantity) || quantity <= 0) {
    toast.error('Quantità non valida');
    return false;
  }
  if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
    toast.error('Prezzo non valido');
    return false;
  }

  const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
  const originalCashBalance = Number(account.cash_balance);

  if (totalAmount > originalCashBalance) {
    toast.error(`Fondi insufficienti (disponibili: ${formatCurrency(originalCashBalance)})`);
    return false;
  }

  const symbol = name.substring(0, 20).toUpperCase();

  // Step 1: Insert manual investment transaction
  const { error: step1Error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: deps.userId,
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
    return false;
  }

  // Step 2: Decrease cash_balance
  const { error: step2Error } = await supabase
    .from('investment_accounts')
    .update({
      cash_balance: Math.round((originalCashBalance - totalAmount) * 100) / 100,
    })
    .eq('id', account.id)
    .eq('user_id', deps.userId);

  if (step2Error) {
    console.error('Error updating cash balance after manual buy:', step2Error);
    // ROLLBACK: delete the just-inserted transaction
    await supabase
      .from('investment_transactions')
      .delete()
      .eq('user_id', deps.userId)
      .eq('investment_account_id', account.id)
      .eq('asset_symbol', symbol)
      .eq('transaction_date', date)
      .eq('quantity', quantity)
      .eq('price_per_unit', pricePerUnit);

    toast.error("Acquisto fallito. Transazione annullata.");
    return false;
  }

  toast.success('Asset aggiunto manualmente');
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}

export interface SellingHolding {
  accountId: string;
  holding: Holding;
}

/** Sells (all or part of) a holding, routing proceeds to the account's cash_balance. Returns true on success. */
export async function performSell(
  sellingHolding: SellingHolding,
  rawQuantity: string,
  rawPrice: string,
  accounts: InvestmentAccount[],
  deps: OpsCommonDeps,
): Promise<boolean> {
  const quantity = parseEuropeanDecimal(rawQuantity);
  const pricePerUnit = parseEuropeanDecimal(rawPrice);

  if (isNaN(quantity) || quantity <= 0) {
    toast.error('Quantità non valida');
    return false;
  }
  if (quantity > sellingHolding.holding.quantity) {
    toast.error(`Quantità massima: ${sellingHolding.holding.quantity}`);
    return false;
  }
  if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
    toast.error('Prezzo non valido');
    return false;
  }

  const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
  const account = accounts.find(a => a.id === sellingHolding.accountId);
  if (!account) return false;

  const originalCashBalance = Number(account.cash_balance);

  // Step 1: Insert sell transaction
  const { error: step1Error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: deps.userId,
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
    return false;
  }

  // Step 2: Route proceeds to cash balance
  const { error: step2Error } = await supabase
    .from('investment_accounts')
    .update({
      cash_balance: Math.round((originalCashBalance + totalAmount) * 100) / 100,
    })
    .eq('id', account.id)
    .eq('user_id', deps.userId);

  if (step2Error) {
    console.error('Error routing sell proceeds:', step2Error);
    // ROLLBACK: delete the sell transaction we just inserted
    await supabase
      .from('investment_transactions')
      .delete()
      .eq('user_id', deps.userId)
      .eq('investment_account_id', sellingHolding.accountId)
      .eq('asset_symbol', sellingHolding.holding.symbol)
      .eq('transaction_type', 'sell')
      .eq('quantity', quantity)
      .eq('price_per_unit', pricePerUnit);

    toast.error('Vendita fallita. Transazione annullata.');
    return false;
  }

  // Calculate P&L
  const pnl = Math.round((pricePerUnit - sellingHolding.holding.avgPrice) * quantity * 100) / 100;
  const pnlStr = pnl >= 0 ? `+${formatCurrency(pnl)}` : `-${formatCurrency(Math.abs(pnl))}`;

  toast.success(`Venduti ${quantity} ${sellingHolding.holding.symbol} - P&L: ${pnlStr}`);
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}

export interface MovingHolding {
  accountId: string;
  holding: Holding;
}

/** Moves (all or part of) a holding from one account to another (no cash impact). Returns true on success. */
export async function performMoveHolding(
  movingHolding: MovingHolding,
  rawQuantity: string,
  destinationId: string,
  accounts: InvestmentAccount[],
  deps: OpsCommonDeps,
): Promise<boolean> {
  const quantity = parseEuropeanDecimal(rawQuantity);
  if (isNaN(quantity) || quantity <= 0) {
    toast.error('Quantità non valida');
    return false;
  }
  if (quantity > movingHolding.holding.quantity) {
    toast.error(`Quantità massima: ${movingHolding.holding.quantity}`);
    return false;
  }
  if (!destinationId) {
    toast.error('Seleziona un conto destinazione');
    return false;
  }

  const destAccount = accounts.find(a => a.id === destinationId);
  if (!destAccount) {
    toast.error('Conto destinazione non trovato');
    return false;
  }

  const { holding, accountId: sourceAccountId } = movingHolding;
  const pricePerUnit = holding.avgPrice;
  const totalAmount = Math.round(quantity * pricePerUnit * 100) / 100;
  const today = new Date().toISOString().split('T')[0];

  // Step 1: INSERT sell in source account (no cash impact)
  const { data: sellData, error: step1Error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: deps.userId,
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
    return false;
  }

  // Step 2: INSERT buy in destination account (no cash impact)
  const { error: step2Error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: deps.userId,
      investment_account_id: destinationId,
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
      .eq('user_id', deps.userId);
    toast.error('Trasferimento fallito. Operazione annullata.');
    return false;
  }

  const qtyStr = quantity % 1 === 0 ? String(quantity) : quantity.toFixed(6);
  toast.success(`Spostati ${qtyStr} ${holding.symbol} in ${destAccount.name}`);
  await deps.loadAccounts();
  deps.onAccountsChanged?.();
  return true;
}
