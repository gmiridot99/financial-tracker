-- Migration: Add direct account flow columns
-- Adds investment_account_id, savings_account_id, trigger_pac to transactions
-- Adds is_primary to savings_accounts

-- Add investment_account_id to transactions (nullable FK to investment_accounts)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS investment_account_id UUID REFERENCES investment_accounts(id) ON DELETE SET NULL;

-- Add savings_account_id to transactions (nullable FK to savings_accounts)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS savings_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL;

-- Add trigger_pac to transactions (boolean, default false)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS trigger_pac BOOLEAN NOT NULL DEFAULT false;

-- Constraint: investment_account_id and savings_account_id cannot both be NOT NULL
ALTER TABLE transactions
  ADD CONSTRAINT check_single_account_destination
  CHECK (NOT (investment_account_id IS NOT NULL AND savings_account_id IS NOT NULL));

-- Add is_primary to savings_accounts
ALTER TABLE savings_accounts
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Partial unique index: at most one primary savings account per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_savings_accounts_primary_per_user
  ON savings_accounts (user_id) WHERE is_primary = true;

-- Index for faster lookup of transactions with account destinations
CREATE INDEX IF NOT EXISTS idx_transactions_investment_account_id
  ON transactions (investment_account_id) WHERE investment_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_savings_account_id
  ON transactions (savings_account_id) WHERE savings_account_id IS NOT NULL;
