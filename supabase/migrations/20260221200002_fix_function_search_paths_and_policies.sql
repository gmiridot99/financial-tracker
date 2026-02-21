-- Migration: Fix function search_path and overly permissive asset_price_history policies
-- No data is modified or deleted.

-- ============================================================
-- FIX: function_search_path_mutable
-- Setting search_path = '' (empty) on each function prevents search_path
-- hijacking attacks where a malicious schema shadows pg_catalog or public.
-- This is the Supabase-recommended remediation for lint 0011.
-- ============================================================

ALTER FUNCTION public.handle_new_user()
  SET search_path = '';

ALTER FUNCTION public.update_wealth_snapshots_updated_at()
  SET search_path = '';

ALTER FUNCTION public.update_unallocated_balances_updated_at()
  SET search_path = '';

ALTER FUNCTION public.update_saved_simulations_updated_at()
  SET search_path = '';

-- ============================================================
-- FIX: rls_policy_always_true on asset_price_history
-- The INSERT and UPDATE policies use USING(true)/WITH CHECK(true),
-- allowing any authenticated user to write shared price data.
-- The API routes that write to this table use the service role key,
-- which bypasses RLS entirely — so these permissive policies are
-- unnecessary and should be removed.
-- The SELECT policy (USING true for authenticated) is intentionally
-- kept, as reading shared price history is safe.
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can insert price history" ON public.asset_price_history;
DROP POLICY IF EXISTS "Authenticated users can update price history" ON public.asset_price_history;
