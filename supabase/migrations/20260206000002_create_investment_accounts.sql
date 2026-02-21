-- Create investment_accounts table
CREATE TABLE IF NOT EXISTS investment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cash_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Create investment_transactions table
CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_account_id UUID NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
  asset_symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'etf', 'crypto', 'commodity', 'bond')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  quantity NUMERIC(18, 8) NOT NULL CHECK (quantity > 0),
  price_per_unit NUMERIC(18, 8) NOT NULL CHECK (price_per_unit > 0),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create asset_prices_cache table
CREATE TABLE IF NOT EXISTS asset_prices_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  asset_type TEXT NOT NULL,
  current_price NUMERIC(18, 8),
  price_currency TEXT NOT NULL DEFAULT 'USD',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_investment_accounts_user_id ON investment_accounts(user_id);
CREATE INDEX idx_investment_transactions_user_id ON investment_transactions(user_id);
CREATE INDEX idx_investment_transactions_account_id ON investment_transactions(investment_account_id);

-- Enable Row Level Security
ALTER TABLE investment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_prices_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies: investment_accounts
CREATE POLICY "Users can view their own investment accounts"
  ON investment_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own investment accounts"
  ON investment_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own investment accounts"
  ON investment_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own investment accounts"
  ON investment_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies: investment_transactions
CREATE POLICY "Users can view their own investment transactions"
  ON investment_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own investment transactions"
  ON investment_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own investment transactions"
  ON investment_transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own investment transactions"
  ON investment_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies: asset_prices_cache (readable by all authenticated users)
CREATE POLICY "Authenticated users can view asset prices"
  ON asset_prices_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert asset prices"
  ON asset_prices_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update asset prices"
  ON asset_prices_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
