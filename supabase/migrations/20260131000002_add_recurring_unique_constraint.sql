-- Add unique constraint to prevent recurring transaction duplicates
-- Partial index only applies to recurring transactions for better performance
CREATE UNIQUE INDEX idx_transactions_no_recurring_duplicates
ON transactions(user_id, type, amount, category, start_date, is_recurring, frequency)
WHERE is_recurring = true;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_transactions_no_recurring_duplicates IS
'Prevents duplicate recurring transactions from being created for the same user, type, amount, category, date, and frequency. Only applies to is_recurring=true rows.';
