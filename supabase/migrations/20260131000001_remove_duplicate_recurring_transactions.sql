-- Remove duplicate recurring transactions
-- Keep only the oldest occurrence of each duplicate set

WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, type, amount, category, start_date, is_recurring, frequency
      ORDER BY created_at ASC
    ) as rn
  FROM transactions
  WHERE is_recurring = true
)
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Log result for verification
COMMENT ON COLUMN transactions.is_recurring IS 'Cleaned duplicates on 2026-01-31';
