-- Migration: Enable RLS on legacy tables that were created before the RLS pattern was established
-- All statements are ADD-only. No data is modified or deleted.

-- ============================================================
-- TABLE: users
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid());

-- Users can update their own row (e.g. email changes)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- TABLE: user_settings
-- ============================================================
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- TABLE: categories
-- IMPORTANT: rows with user_id IS NULL are global defaults (seeded at migration time).
-- SELECT must allow both own rows AND global defaults.
-- INSERT/UPDATE/DELETE restricted to own rows only.
-- ============================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and default categories"
  ON public.categories FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert own categories"
  ON public.categories FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- TABLE: investment_categories
-- Same pattern as categories: user_id IS NULL = global default.
-- ============================================================
ALTER TABLE public.investment_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and default investment categories"
  ON public.investment_categories FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert own investment categories"
  ON public.investment_categories FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own investment categories"
  ON public.investment_categories FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own investment categories"
  ON public.investment_categories FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- TABLE: investment_allocations
-- ============================================================
ALTER TABLE public.investment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own investment allocations"
  ON public.investment_allocations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own investment allocations"
  ON public.investment_allocations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own investment allocations"
  ON public.investment_allocations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own investment allocations"
  ON public.investment_allocations FOR DELETE
  USING (user_id = auth.uid());
