/**
 * Recurring transaction copy utilities
 */

import { supabase } from './supabase';
import { endOfMonth, subMonths, startOfMonth } from 'date-fns';

/**
 * Copy recurring transactions from previous month to current month
 * Simple manual copy - no complex generation logic
 */
export async function copyRecurringFromPreviousMonth(
  userId: string,
  year: number,
  month: number
): Promise<void> {
  // Calculate previous month
  const currentDate = new Date(year, month - 1, 1);
  const prevDate = subMonths(currentDate, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  // Get recurring transactions from previous month
  const prevMonthStart = startOfMonth(prevDate);
  const prevMonthEnd = endOfMonth(prevDate);

  const { data: prevTransactions, error: queryError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_recurring', true)
    .gte('start_date', prevMonthStart.toISOString().split('T')[0])
    .lte('start_date', prevMonthEnd.toISOString().split('T')[0]);

  if (queryError) {
    console.error('Error querying previous month transactions:', queryError);
    throw queryError;
  }

  if (!prevTransactions || prevTransactions.length === 0) {
    console.log('No recurring transactions found in previous month');
    return;
  }

  // Calculate day for current month (handle short months like Feb)
  const currentMonthEnd = endOfMonth(currentDate);
  const maxDayInCurrentMonth = currentMonthEnd.getDate();

  // Create copies for current month
  const transactionsToCreate = prevTransactions.map(t => {
    const prevStartDate = new Date(t.start_date);
    const dayOfMonth = prevStartDate.getDate();

    // Clamp to last day of current month if needed (Jan 31 -> Feb 28)
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

  // Insert copies (let database constraint prevent duplicates if button clicked twice)
  const { error: insertError } = await supabase
    .from('transactions')
    .insert(transactionsToCreate);

  if (insertError) {
    // If constraint violation, some already exist - that's OK
    if (insertError.code === '23505') {
      console.log('Some transactions already exist in current month');
      return; // Success - already imported
    }

    // Other errors are real problems
    console.error('Error inserting copied transactions:', insertError);
    throw insertError;
  }

  console.log(`Copied ${transactionsToCreate.length} recurring transactions to ${year}-${month}`);
}
