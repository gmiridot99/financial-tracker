-- Add manual override columns to unallocated_balances
-- When TRUE, recalculateUnallocated() will NOT overwrite the value
ALTER TABLE unallocated_balances
  ADD COLUMN savings_manual_override BOOLEAN DEFAULT FALSE,
  ADD COLUMN investments_manual_override BOOLEAN DEFAULT FALSE;
