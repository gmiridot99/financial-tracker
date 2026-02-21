-- Add 'manual' to the asset_type check constraint on investment_transactions
ALTER TABLE investment_transactions
  DROP CONSTRAINT investment_transactions_asset_type_check;

ALTER TABLE investment_transactions
  ADD CONSTRAINT investment_transactions_asset_type_check
  CHECK (asset_type IN ('stock', 'etf', 'crypto', 'commodity', 'bond', 'manual'));
