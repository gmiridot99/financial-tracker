-- Add default Investimenti category
-- This category is used for tracking investments separately from regular expenses

INSERT INTO categories (name, type, user_id, created_at, updated_at)
VALUES ('Investimenti', 'expense', NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;
