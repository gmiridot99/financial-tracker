import { supabase } from '@/lib/supabase';
import { fetchMarketPrices } from '@/lib/market-prices';
import type { PacRule } from '@/types/database';

// ── Types ────────────────────────────────────────────────────────────

export interface PacAppliedBuy {
  symbol: string;
  name: string;
  quantity: number;
  amount: number;
  pricePerUnit: number;
  transactionId?: string;
}

export interface PacSkipped {
  symbol: string;
  reason: string;
}

export interface PacExecutionResult {
  applied: PacAppliedBuy[];
  skipped: PacSkipped[];
  totalInvested: number;
}

// ── Execution ────────────────────────────────────────────────────────

/**
 * Executes PAC (Piano di Accumulo) auto-buy after a deposit.
 *
 * For each active rule:
 * 1. Calculates the amount to invest: depositAmount * (percentage / 100)
 * 2. Fetches the current market price for the asset
 * 3. Calculates the quantity: amount / marketPrice
 * 4. Inserts a buy transaction in the DB
 *
 * After all buys, decrements the account cash_balance by total invested.
 *
 * Uses tracked rollback: if any step fails, all previously-inserted
 * transactions are deleted and cash_balance is restored.
 *
 * @param userId - Authenticated user ID (RLS filter)
 * @param accountId - Investment account ID
 * @param depositAmount - The deposit amount that triggers PAC
 * @param rules - Active PAC rules for this account
 * @returns Result with applied buys, skipped assets, and total invested
 */
export async function executePac({
  userId,
  accountId,
  depositAmount,
  rules,
  accessToken,
}: {
  userId: string;
  accountId: string;
  depositAmount: number;
  rules: PacRule[];
  accessToken?: string;
}): Promise<PacExecutionResult> {
  const activeRules = rules.filter(r => r.is_active);

  if (activeRules.length === 0) {
    return { applied: [], skipped: [], totalInvested: 0 };
  }

  const applied: PacAppliedBuy[] = [];
  const skipped: PacSkipped[] = [];

  // ── Step 1: Fetch market prices for all PAC assets ──────────────

  const symbols = activeRules.map(r => r.asset_symbol);

  // Build crypto map from rules (crypto assets have coingecko_id stored
  // in the asset_type metadata, but for PAC we rely on the prices API
  // which handles crypto via symbol lookup)
  let priceMap: Map<string, { priceEur: number }>;
  try {
    priceMap = await fetchMarketPrices(symbols, undefined, accessToken);
  } catch {
    // If price fetch fails entirely, skip all
    for (const rule of activeRules) {
      skipped.push({ symbol: rule.asset_symbol, reason: 'Prezzo non disponibile' });
    }
    return { applied: [], skipped, totalInvested: 0 };
  }

  // ── Step 2: Calculate buys and filter assets with valid prices ──

  interface PendingBuy {
    rule: PacRule;
    amount: number;
    quantity: number;
    pricePerUnit: number;
  }

  const pendingBuys: PendingBuy[] = [];

  for (const rule of activeRules) {
    const price = priceMap.get(rule.asset_symbol);

    if (!price || price.priceEur <= 0) {
      skipped.push({
        symbol: rule.asset_symbol,
        reason: 'Prezzo non disponibile',
      });
      continue;
    }

    const amount = Math.round(depositAmount * (rule.percentage / 100) * 100) / 100;
    if (amount <= 0) {
      skipped.push({
        symbol: rule.asset_symbol,
        reason: 'Importo calcolato troppo basso',
      });
      continue;
    }

    const quantity = Math.round((amount / price.priceEur) * 100000000) / 100000000; // 8 decimal places for crypto

    pendingBuys.push({
      rule,
      amount,
      quantity,
      pricePerUnit: price.priceEur,
    });
  }

  if (pendingBuys.length === 0) {
    return { applied: [], skipped, totalInvested: 0 };
  }

  // ── Step 3: Insert transactions with tracked rollback ──────────

  const insertedTransactionIds: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  for (const buy of pendingBuys) {
    const { data, error } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: userId,
        investment_account_id: accountId,
        asset_symbol: buy.rule.asset_symbol,
        asset_name: buy.rule.asset_name,
        asset_type: buy.rule.asset_type === 'index' ? 'stock' : buy.rule.asset_type,
        transaction_type: 'buy',
        quantity: buy.quantity,
        price_per_unit: buy.pricePerUnit,
        total_amount: buy.amount,
        currency: 'EUR',
        transaction_date: today,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`PAC: Error inserting buy for ${buy.rule.asset_symbol}:`, error);
      // Rollback all previously inserted transactions
      await rollbackInsertedTransactions(insertedTransactionIds, userId);
      // Return partial result with error info
      skipped.push({
        symbol: buy.rule.asset_symbol,
        reason: 'Errore inserimento transazione',
      });
      return {
        applied: [],
        skipped: [
          ...skipped,
          ...pendingBuys
            .filter(b => !insertedTransactionIds.length || b !== buy)
            .filter(b => !skipped.some(s => s.symbol === b.rule.asset_symbol))
            .map(b => ({ symbol: b.rule.asset_symbol, reason: 'Rollback per errore' })),
        ],
        totalInvested: 0,
      };
    }

    insertedTransactionIds.push(data.id);
    applied.push({
      symbol: buy.rule.asset_symbol,
      name: buy.rule.asset_name,
      quantity: buy.quantity,
      amount: buy.amount,
      pricePerUnit: buy.pricePerUnit,
      transactionId: data.id,
    });
  }

  // ── Step 4: Decrease cash_balance by total invested ────────────

  const totalInvested = Math.round(
    applied.reduce((sum, a) => sum + a.amount, 0) * 100
  ) / 100;

  // Read current cash_balance first
  const { data: accountData, error: readError } = await supabase
    .from('investment_accounts')
    .select('cash_balance')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  if (readError || !accountData) {
    console.error('PAC: Error reading account balance:', readError);
    await rollbackInsertedTransactions(insertedTransactionIds, userId);
    return {
      applied: [],
      skipped: applied.map(a => ({ symbol: a.symbol, reason: 'Errore lettura saldo' })),
      totalInvested: 0,
    };
  }

  const currentCashBalance = Number(accountData.cash_balance);
  const newCashBalance = Math.round((currentCashBalance - totalInvested) * 100) / 100;

  if (newCashBalance < 0) {
    // Not enough cash - this shouldn't happen if deposit was applied,
    // but safeguard: rollback everything
    console.error('PAC: Insufficient cash balance after deposit');
    await rollbackInsertedTransactions(insertedTransactionIds, userId);
    return {
      applied: [],
      skipped: applied.map(a => ({ symbol: a.symbol, reason: 'Fondi insufficienti' })),
      totalInvested: 0,
    };
  }

  const { error: updateError } = await supabase
    .from('investment_accounts')
    .update({ cash_balance: newCashBalance })
    .eq('id', accountId)
    .eq('user_id', userId);

  if (updateError) {
    console.error('PAC: Error updating cash balance:', updateError);
    // Rollback all inserted transactions
    await rollbackInsertedTransactions(insertedTransactionIds, userId);
    return {
      applied: [],
      skipped: applied.map(a => ({ symbol: a.symbol, reason: 'Errore aggiornamento saldo' })),
      totalInvested: 0,
    };
  }

  return { applied, skipped, totalInvested };
}

// ── Rollback helper ──────────────────────────────────────────────────

async function rollbackInsertedTransactions(
  transactionIds: string[],
  userId: string
): Promise<void> {
  for (const id of transactionIds) {
    const { error } = await supabase
      .from('investment_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error(`CRITICAL: PAC rollback failed for transaction ${id}:`, error);
    }
  }
}
