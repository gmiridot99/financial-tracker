/**
 * Recurring transaction copy utilities
 */

import { supabase } from './supabase';
import { endOfMonth, subMonths, startOfMonth } from 'date-fns';
import { executePac } from './pac-execution';
import type { PacRule } from '@/types/database';

/**
 * Copy recurring transactions AND transfers from previous month to current month.
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

  const prevStartStr = prevMonthStart.toISOString().split('T')[0];
  const prevEndStr = prevMonthEnd.toISOString().split('T')[0];

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
      const prevStartDate = new Date(t.start_date);
      const dayOfMonth = prevStartDate.getDate();
      const clampedDay = Math.min(dayOfMonth, maxDayInCurrentMonth);
      const newDate = new Date(year, month - 1, clampedDay);
      const newDateStr = newDate.toISOString().split('T')[0];

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

  // ── 2. Copy recurring transfers ──────────────────────────────────────

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
      const prevDate = new Date(transfer.date);
      const dayOfMonth = prevDate.getDate();
      const clampedDay = Math.min(dayOfMonth, maxDayInCurrentMonth);
      const newDate = new Date(year, month - 1, clampedDay);
      const newDateStr = newDate.toISOString().split('T')[0];

      // Attempt INSERT — skip on duplicate (already imported)
      const { data: insertedTransfer, error: insertError } = await supabase
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
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          // Already imported — skip silently
          continue;
        }
        console.error('Error inserting recurring transfer:', insertError);
        continue; // Non-fatal: log and continue with other transfers
      }

      if (!insertedTransfer) continue;

      const insertedId = insertedTransfer.id;
      const amount = Number(transfer.amount);

      // ── Atomic balance updates with rollback ──────────────────────

      // Read source savings account balance
      const { data: sourceAccount, error: sourceReadError } = await supabase
        .from('savings_accounts')
        .select('balance')
        .eq('id', transfer.from_savings_account_id)
        .eq('user_id', userId)
        .single();

      if (sourceReadError || !sourceAccount) {
        console.error('Error reading source balance for recurring transfer:', sourceReadError);
        await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
        continue;
      }

      const originalSourceBalance = Number(sourceAccount.balance);
      const newSourceBalance = Math.round((originalSourceBalance - amount) * 100) / 100;

      if (newSourceBalance < 0) {
        // Insufficient balance — skip this transfer copy
        console.log(`Recurring transfer skipped: insufficient balance on source account`);
        await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
        continue;
      }

      // Decrement source
      const { error: sourceUpdateError } = await supabase
        .from('savings_accounts')
        .update({ balance: newSourceBalance })
        .eq('id', transfer.from_savings_account_id)
        .eq('user_id', userId);

      if (sourceUpdateError) {
        console.error('Error decrementing source balance for recurring transfer:', sourceUpdateError);
        await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
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
          await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
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
          await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
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
          await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
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
          await supabase.from('transfers').delete().eq('id', insertedId).eq('user_id', userId);
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
            console.error('PAC execution failed for recurring transfer:', pacError);
          }
        }
      }

      transfersCopied++;
    }
  }

  console.log(
    `Copied ${transactionsCopied} recurring transactions and ${transfersCopied} recurring transfers to ${year}-${month}`
  );

  return { transactionsCopied, transfersCopied };
}
