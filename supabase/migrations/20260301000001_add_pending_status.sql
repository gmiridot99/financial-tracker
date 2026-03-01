-- Add status column to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('pending', 'active'))
    DEFAULT NULL;

-- Add status column to transfers
ALTER TABLE transfers
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('pending', 'active'))
    DEFAULT NULL;

-- Index for fast lookup of pending transactions by user + date
CREATE INDEX IF NOT EXISTS idx_transactions_pending
  ON transactions (user_id, start_date)
  WHERE status = 'pending';

-- Index for fast lookup of pending transfers by user + date
CREATE INDEX IF NOT EXISTS idx_transfers_pending
  ON transfers (user_id, date)
  WHERE status = 'pending';
