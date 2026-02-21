CREATE TABLE pac_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_account_id UUID NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
  asset_symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one rule per asset per account per user
ALTER TABLE pac_rules ADD CONSTRAINT pac_rules_unique_asset
  UNIQUE (user_id, investment_account_id, asset_symbol);

-- RLS
ALTER TABLE pac_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own PAC rules"
  ON pac_rules FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PAC rules"
  ON pac_rules FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PAC rules"
  ON pac_rules FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own PAC rules"
  ON pac_rules FOR DELETE USING (auth.uid() = user_id);

-- Index for fast per-account lookups
CREATE INDEX idx_pac_rules_account ON pac_rules(user_id, investment_account_id);
