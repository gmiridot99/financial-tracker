-- Fix users table to work with Supabase Auth
-- Supabase Auth manages passwords internally, so we don't need password_hash

-- Make password_hash nullable (or drop it entirely)
ALTER TABLE public.users
ALTER COLUMN password_hash DROP NOT NULL;

-- Alternative: Drop the column entirely (uncomment if preferred)
-- ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
