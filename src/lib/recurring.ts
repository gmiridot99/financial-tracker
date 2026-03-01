/**
 * Recurring transaction copy utilities
 */

import { supabase } from './supabase';
import { endOfMonth, subMonths, startOfMonth } from 'date-fns';
import { executePac } from './pac-execution';
import type { PacRule } from '@/types/database';

/** Format a Date as YYYY-MM-DD using LOCAL time (not UTC). */
function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Extract the day-of-month from a YYYY-MM-DD string without Date parsing (avoids UTC shift). */
function dayFromDateStr(dateStr: string): number {
  return parseInt(dateStr.split('-')[2], 10);
}

/**
 * Copy recurring transactions AND transfers from previous month to current month.
 * Copied items are inserted with status='pending' — balances are NOT updated yet.
 * Call activatePendingRecurring() to apply balance changes when the date arrives.
 * Returns counts of items copied.
 */
export async function copyRecurringFromPreviousMonth(
  userId: string,
  year: number,
  month: number
): Promise<{ transactionsCopied: number; transfersCopied: number }> {
  // Calculate previous month
  const currentDate = new Date(year, month - 1, 1);
  const prevDate = subMonths(currentDate, 1);

  // Get recurring transactions from previous month
  const prevMonthStart = startOfMonth(prevDate);
  const prevMonthEnd = endOfMonth(prevDate);

  const prevStartStr = localDateStr(prevMonthStart);
  const prevEndStr = localDateStr(prevMonthEnd);

  // Calculate day clamping for current month
  const currentMonthEnd = endOfMonth(currentDate);
  const maxDayInCurrentMonth = currentMonthEnd.getDate();

  // ── 1. Copy recurring transactions ──────────────────────────────────

  const { data: prevTransactions, error: queryError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_recurring', true)
    .gte('start_date', prevStartStr)
    .lte('start_date', prevEndStr);

  if (queryError) {
    console.error('Error querying previous month transactions:', queryError);
    throw queryError;
  }

  let transactionsCopied = 0;

  if (prevTransactions && prevTransactions.length > 0) {
    const transactionsToCreate = prevTransactions.map(t => {
      const dayOfMonth = dayFromDateStr(t.start_date);
      const clampedDay = Math.min(dayOfMonth, maxDayInCurrentMonth);
      const newDateStr = localDateStr(new Date(year, month - 1, clampedDay));

      return {
        user_id: t.user_id,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        category: t.category,
        is_recurring: true,
        frequency: t.frequency,
        start_date: newDateStr,
        description: t.description,
        savings_account_id: t.savings_account_id,
        investment_account_id: t.investment_account_id,
        trigger_pac: t.trigger_pac,
        status: 'pending' as const,
      };
    });

    const { error: insertError } = await supabase
      .from('transactions')
      .insert(transactionsToCreate);

    if (insertError) {
      if (insertError.code === '23505') {
        console.log('Some transactions already exist in current month');
      } else {
        console.error('Error inserting copied transactions:', insertError);
        throw insertError;
      }
    } else {
      transactionsCopied = transactionsToCreate.length;
    }
  }

  // ── 2. Copy recurring transfers (pending only — no balance updates) ──

  const { data: prevTransfers, error: transferQueryError } = await supabase
    .from('transfers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_recurring', true)
    .gte('date', prevStartStr)
    .lte('date', prevEndStr);

  if (transferQueryError) {
    console.error('Error querying previous month transfers:', transferQueryError);
    throw transferQueryError;
  }

  let transfersCopied = 0;

  if (prevTransfers && prevTransfers.length > 0) {
    for (const transfer of prevTransfers) {
      const dayOfMonth = dayFromDateStr(transfer.date);
      const clampedDay = Math.min(dayOfMonth, maxDayInCurrentMonth);
      const newDateStr = localDateStr(new Date(year, month - 1, clampedDay));

      const { error: insertError } = await supabase
        .from('transfers')
        .insert({
          user_id: userId,
          amount: transfer.amount,
          date: newDateStr,
          note: transfer.note,
          is_recurring: true,
          frequency: transfer.frequency,
          trigger_pac: transfer.trigger_pac,
          from_savings_account_id: transfer.from_savings_account_id,
          to_savings_account_id: transfer.to_savings_account_id,
          to_investment_account_id: transfer.to_investment_account_id,
          status: 'pending' as const,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          // Already imported — skip silently
          continue;
        }
        console.error('Error inserting recurring transfer:', insertError);
        continue; // Non-fatal: log and continue
      }

      transfersCopied++;
    }
  }

  console.log(
    `Copied ${transactionsCopied} recurring transactions and ${transfersCopied} recurring transfers to ${year}-${month} (status=pending)`
  );

  return { transactionsCopied, transfersCopied };
}

/**
 * Activate all pending recurring transactions and transfers whose date has arrived.
 * For each item with status='pending' and date <= today:
 *   - Transactions: apply balance changes on linked account, then set status='active'
 *   - Transfers: execute atomic balance update (source-, dest+, PAC), then set status='active'
 *
 * Returns counts of items activated.
 */
export async function activatePendingRecurring(
  userId: string
): Promise<{ transactionsActivated: number; transfersActivated: number }> {
  const today = localDateStr(new Date());

  // ── 1. Activate pending transactions ────────────────────────────────

  const { data: pendingTransactions, error: txQueryError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lte('start_date', today);

  if (txQueryError) {
    console.error('Error querying pending transactions:', txQueryError);
    throw txQueryError;
  }

  let transactionsActivated = 0;

  for (const tx of (pendingTransactions ?? [])) {
    const amount = Number(tx.amount);

    if (tx.savings_account_id) {
      // income → balance += amount, expense → balance -= amount
      const { data: account, error: readError } = await supabase
        .from('savings_accounts')
        .select('balance')
        .eq('id', tx.savings_account_id)
        .eq('user_id', userId)
        .single();

      if (!readError && account) {
        const delta = tx.type === 'income' ? amount : -amount;
        const newBalance = Math.round((Number(account.balance) + delta) * 100) / 100;
        await supabase
          .from('savings_accounts')
          .update({ balance: newBalance })
          .eq('id', tx.savings_account_id)
          .eq('user_id', userId);
      }
    } else if (tx.investment_account_id) {
      // income → cash_balance += amount, expense → cash_balance -= amount
      const { data: account, error: readError } = await supabase
        .from('investment_accounts')
        .select('cash_balance')
        .eq('id', tx.investment_account_id)
        .eq('user_id', userId)
        .single();

      if (!readError && account) {
        const delta = tx.type === 'income' ? amount : -amount;
        const newBalance = Math.round((Number(account.cash_balance) + delta) * 100) / 100;
        await supabase
          .from('investment_accounts')
          .update({ cash_balance: newBalance })
          .eq('id', tx.investment_account_id)
          .eq('user_id', userId);
      }
    }
    // No linked account: just activate visually (status only)

    const { error: activateError } = await supabase
      .from('transactions')
      .update({ status: 'active' })
      .eq('id', tx.id)
      .eq('user_id', userId);

    if (!activateError) transactionsActivated++;
  }

  // ── 2. Activate pending transfers ────────────────────────────────────

  const { data: pendingTransfers, error: trQueryError } = await supabase
    .from('transfers')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lte('date', today);

  if (trQueryError) {
    console.error('Error querying pending transfers:', trQueryError);
    throw trQueryError;
  }

  let transfersActivated = 0;

  for (const transfer of (pendingTransfers ?? [])) {
    const amount = Number(transfer.amount);

    // Read source savings account
    const { data: sourceAccount, error: sourceReadError } = await supabase
      .from('savings_accounts')
      .select('balance')
      .eq('id', transfer.from_savings_account_id)
      .eq('user_id', userId)
      .single();

    if (sourceReadError || !sourceAccount) {
      console.error('Error reading source balance for pending transfer:', sourceReadError);
      continue;
    }

    const originalSourceBalance = Number(sourceAccount.balance);
    const newSourceBalance = Math.round((originalSourceBalance - amount) * 100) / 100;

    if (newSourceBalance < 0) {
      console.log(`Pending transfer skipped: insufficient balance on source account`);
      continue;
    }

    // Decrement source
    const { error: sourceUpdateError } = await supabase
      .from('savings_accounts')
      .update({ balance: newSourceBalance })
      .eq('id', transfer.from_savings_account_id)
      .eq('user_id', userId);

    if (sourceUpdateError) {
      console.error('Error decrementing source balance for pending transfer:', sourceUpdateError);
      continue;
    }

    // Increment destination (savings or investment)
    if (transfer.to_savings_account_id) {
      const { data: destAccount, error: destReadError } = await supabase
        .from('savings_accounts')
        .select('balance')
        .eq('id', transfer.to_savings_account_id)
        .eq('user_id', userId)
        .single();

      if (destReadError || !destAccount) {
        // Rollback source
        await supabase
          .from('savings_accounts')
          .update({ balance: originalSourceBalance })
          .eq('id', transfer.from_savings_account_id)
          .eq('user_id', userId);
        continue;
      }

      const newDestBalance = Math.round((Number(destAccount.balance) + amount) * 100) / 100;
      const { error: destUpdateError } = await supabase
        .from('savings_accounts')
        .update({ balance: newDestBalance })
        .eq('id', transfer.to_savings_account_id)
        .eq('user_id', userId);

      if (destUpdateError) {
        // Rollback source
        await supabase
          .from('savings_accounts')
          .update({ balance: originalSourceBalance })
          .eq('id', transfer.from_savings_account_id)
          .eq('user_id', userId);
        continue;
      }
    } else if (transfer.to_investment_account_id) {
      const { data: destAccount, error: destReadError } = await supabase
        .from('investment_accounts')
        .select('cash_balance')
        .eq('id', transfer.to_investment_account_id)
        .eq('user_id', userId)
        .single();

      if (destReadError || !destAccount) {
        // Rollback source
        await supabase
          .from('savings_accounts')
          .update({ balance: originalSourceBalance })
          .eq('id', transfer.from_savings_account_id)
          .eq('user_id', userId);
        continue;
      }

      const newDestBalance = Math.round((Number(destAccount.cash_balance) + amount) * 100) / 100;
      const { error: destUpdateError } = await supabase
        .from('investment_accounts')
        .update({ cash_balance: newDestBalance })
        .eq('id', transfer.to_investment_account_id)
        .eq('user_id', userId);

      if (destUpdateError) {
        // Rollback source
        await supabase
          .from('savings_accounts')
          .update({ balance: originalSourceBalance })
          .eq('id', transfer.from_savings_account_id)
          .eq('user_id', userId);
        continue;
      }

      // Execute PAC if requested
      if (transfer.trigger_pac) {
        try {
          const { data: pacRules } = await supabase
            .from('pac_rules')
            .select('*')
            .eq('user_id', userId)
            .eq('investment_account_id', transfer.to_investment_account_id)
            .eq('is_active', true);

          if (pacRules && pacRules.length > 0) {
            await executePac({
              userId,
              accountId: transfer.to_investment_account_id,
              depositAmount: amount,
              rules: pacRules as PacRule[],
            });
          }
        } catch (pacError) {
          // PAC failure is non-fatal for the transfer itself
          console.error('PAC execution failed for pending transfer:', pacError);
        }
      }
    }

    // Set status = 'active'
    const { error: activateError } = await supabase
      .from('transfers')
      .update({ status: 'active' })
      .eq('id', transfer.id)
      .eq('user_id', userId);

    if (!activateError) transfersActivated++;
  }

  console.log(
    `Activated ${transactionsActivated} pending transactions and ${transfersActivated} pending transfers`
  );

  return { transactionsActivated, transfersActivated };
}
