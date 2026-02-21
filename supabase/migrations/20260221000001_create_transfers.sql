-- Migration: Create transfers table for inter-account money movements
-- Transfers replace the Investimenti/Risparmi expense categories for moving money between accounts
-- Each transfer debits a savings account and credits either another savings or an investment account

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  note TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT CHECK (frequency IN ('monthly', 'weekly', 'yearly')),
  trigger_pac BOOLEAN NOT NULL DEFAULT false,

  -- Source: always a savings account (checking/savings)
  from_savings_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,

  -- Destination: exactly one must be set (enforced by constraint below)
  to_savings_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,
  to_investment_account_id UUID REFERENCES investment_accounts(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exactly one destination must be provided
  CONSTRAINT exactly_one_destination CHECK (
    (to_savings_account_id IS NOT NULL)::int +
    (to_investment_account_id IS NOT NULL)::int = 1
  )
);

-- Enable Row Level Security
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own transfers
CREATE POLICY transfers_user ON transfers
  FOR ALL
  USING (user_id = auth.uid());

-- Idempotency index for recurring transfer imports
-- Prevents duplicate copies when "Importa ricorrenti" is clicked multiple times
CREATE UNIQUE INDEX IF NOT EXISTS transfers_recurring_dedup
  ON transfers (
    user_id,
    from_savings_account_id,
    COALESCE(to_savings_account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(to_investment_account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    date
  )
  WHERE is_recurring = true;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_transfers_user_date
  ON transfers (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_from_savings
  ON transfers (from_savings_account_id) WHERE from_savings_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transfers_to_savings
  ON transfers (to_savings_account_id) WHERE to_savings_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transfers_to_investment
  ON transfers (to_investment_account_id) WHERE to_investment_account_id IS NOT NULL;
