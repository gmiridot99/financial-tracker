-- Migration: Add index on asset_prices_cache.coingecko_id
-- The crypto prices route queries .in('coingecko_id', ids) which is a full table scan without this index.
-- Partial index (WHERE coingecko_id IS NOT NULL) excludes stock rows that don't have a coingecko_id.

CREATE INDEX IF NOT EXISTS idx_asset_prices_cache_coingecko_id
  ON asset_prices_cache(coingecko_id)
  WHERE coingecko_id IS NOT NULL;
