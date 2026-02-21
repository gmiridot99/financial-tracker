-- Create savings_accounts table
CREATE TABLE IF NOT EXISTS savings_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Create savings_auto_rules table
CREATE TABLE IF NOT EXISTS savings_auto_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  savings_account_id UUID NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
  percentage NUMERIC(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create savings_transfers table
CREATE TABLE IF NOT EXISTS savings_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,
  to_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_savings_accounts_user_id ON savings_accounts(user_id);
CREATE INDEX idx_savings_auto_rules_user_id ON savings_auto_rules(user_id);
CREATE INDEX idx_savings_auto_rules_account_id ON savings_auto_rules(savings_account_id);
CREATE INDEX idx_savings_transfers_user_id ON savings_transfers(user_id);

-- Enable Row Level Security
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_auto_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: savings_accounts
CREATE POLICY "Users can view their own savings accounts"
  ON savings_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings accounts"
  ON savings_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings accounts"
  ON savings_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings accounts"
  ON savings_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies: savings_auto_rules
CREATE POLICY "Users can view their own savings auto rules"
  ON savings_auto_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings auto rules"
  ON savings_auto_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings auto rules"
  ON savings_auto_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings auto rules"
  ON savings_auto_rules FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies: savings_transfers
CREATE POLICY "Users can view their own savings transfers"
  ON savings_transfers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings transfers"
  ON savings_transfers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings transfers"
  ON savings_transfers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings transfers"
  ON savings_transfers FOR DELETE
  USING (auth.uid() = user_id);
