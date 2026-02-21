-- Create asset_price_history table for tracking daily price snapshots
CREATE TABLE asset_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  price_eur NUMERIC(18,8) NOT NULL,
  price_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per symbol per day
ALTER TABLE asset_price_history ADD CONSTRAINT asset_price_history_unique_day
  UNIQUE (symbol, price_date);

-- Enable Row Level Security
ALTER TABLE asset_price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: readable/writable by all authenticated users (shared price data)
CREATE POLICY "Authenticated users can read price history"
  ON asset_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert price history"
  ON asset_price_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update price history"
  ON asset_price_history FOR UPDATE TO authenticated USING (true);

-- Index for efficient lookups by symbol + date range
CREATE INDEX idx_price_history_symbol_date ON asset_price_history(symbol, price_date DESC);

-- Add coingecko_id column to existing asset_prices_cache table
ALTER TABLE asset_prices_cache ADD COLUMN IF NOT EXISTS coingecko_id TEXT;
