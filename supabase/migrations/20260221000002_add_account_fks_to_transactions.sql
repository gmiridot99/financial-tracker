-- Migration: Add from/to savings account columns to transactions
-- These columns track which savings account is debited (expenses) or credited (income)
-- in the new real-time account flow model

-- Add from_savings_account_id: the savings account debited when recording an expense
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS from_savings_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL;

-- Add to_savings_account_id: the savings account credited when recording income
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS to_savings_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_from_savings_account
  ON transactions (from_savings_account_id) WHERE from_savings_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_to_savings_account
  ON transactions (to_savings_account_id) WHERE to_savings_account_id IS NOT NULL;

-- Backfill: set to_savings_account_id for existing income transactions
-- Uses the primary savings account as the default destination
UPDATE transactions t
SET to_savings_account_id = (
  SELECT id FROM savings_accounts
  WHERE user_id = t.user_id AND is_primary = true
  LIMIT 1
)
WHERE t.type = 'income'
  AND t.to_savings_account_id IS NULL;

-- Backfill: set from_savings_account_id for existing regular expense transactions
-- (excludes Investimenti/Risparmi which had their own routing via investment_account_id/savings_account_id)
UPDATE transactions t
SET from_savings_account_id = (
  SELECT id FROM savings_accounts
  WHERE user_id = t.user_id AND is_primary = true
  LIMIT 1
)
WHERE t.type = 'expense'
  AND t.from_savings_account_id IS NULL
  AND t.investment_account_id IS NULL
  AND t.savings_account_id IS NULL;
