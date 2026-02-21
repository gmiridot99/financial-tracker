# Supabase Security & Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable RLS on 5 legacy tables, add auth guard to all API routes, and add a missing performance index — with zero data deletion.

**Architecture:** Two SQL migration files (ADD-only, idempotent) applied via `npx supabase db push`, plus a TypeScript auth-guard utility used by all 5 `/api/assets/` routes. No tables or data are dropped.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + Auth), TypeScript strict mode

**Design doc:** `docs/plans/2026-02-21-supabase-security-performance-design.md`

---

## Background: Why These Tables Are Missing RLS

The first migrations (Jan 29 2026) created `users`, `user_settings`, `categories`, `investment_categories`, and `investment_allocations` **before the team established the RLS pattern**. Every table created after Feb 1 correctly enables RLS. These 5 tables never got patched. They are the likely cause of the Supabase Advisor security flags.

**Special case — categories & investment_categories**: global default rows have `user_id = NULL`. RLS SELECT policies must allow `user_id IS NULL OR user_id = auth.uid()` so the seeded defaults remain readable.

---

## Task 1: Migration — Enable RLS on legacy tables

**Files:**
- Create: `supabase/migrations/20260221100001_enable_rls_legacy_tables.sql`

**Step 1: Create the migration file**

```sql
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
```

**Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected output: migration `20260221100001_enable_rls_legacy_tables.sql` applied successfully.

**Step 3: Verify migration applied**

```bash
npx supabase migration list
```

Confirm `20260221100001_enable_rls_legacy_tables.sql` is marked as applied (remote ✓).

---

## Task 2: Migration — Add coingecko_id performance index

**Files:**
- Create: `supabase/migrations/20260221100002_add_coingecko_id_index.sql`

**Step 1: Create the migration file**

```sql
-- Migration: Add index on asset_prices_cache.coingecko_id
-- The crypto prices route queries .in('coingecko_id', ids) which is a full table scan without this index.
-- Partial index (WHERE coingecko_id IS NOT NULL) excludes stock rows that don't have a coingecko_id.

CREATE INDEX IF NOT EXISTS idx_asset_prices_cache_coingecko_id
  ON asset_prices_cache(coingecko_id)
  WHERE coingecko_id IS NOT NULL;
```

**Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: `20260221100002_add_coingecko_id_index.sql` applied successfully.

**Step 3: Verify**

```bash
npx supabase migration list
```

Both new migrations should now be marked applied.

---

## Task 3: Create API auth guard utility

**Files:**
- Create: `src/lib/api-auth.ts`

**Step 1: Create the utility**

This utility extracts and verifies the Supabase JWT from the `Authorization` header. It returns the authenticated user or null.

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Returns the user if authenticated, null otherwise.
 *
 * Usage in API route:
 *   const user = await getAuthenticatedUser(request);
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  // Create a user-scoped client (not service role) to validate the token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return user;
}
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

---

## Task 4: Add auth guard to `/api/assets/search`

**Files:**
- Modify: `src/app/api/assets/search/route.ts`

**Step 1: Add the auth check at the top of the handler**

In [src/app/api/assets/search/route.ts](src/app/api/assets/search/route.ts), add the import and auth check:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getAuthenticatedUser } from '@/lib/api-auth';

// ... (rest of existing code unchanged)

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q');
  // ... rest of handler unchanged
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

---

## Task 5: Add auth guard to `/api/assets/prices`

**Files:**
- Modify: `src/app/api/assets/prices/route.ts`

**Step 1: Add the import and auth check**

In [src/app/api/assets/prices/route.ts](src/app/api/assets/prices/route.ts), add:

```typescript
import { getAuthenticatedUser } from '@/lib/api-auth';
```

And at the top of the `GET` handler body, before any other logic:

```typescript
const user = await getAuthenticatedUser(request);
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

---

## Task 6: Add auth guard to `/api/assets/history`

**Files:**
- Modify: `src/app/api/assets/history/route.ts`

**Step 1: Add the import and auth check**

In [src/app/api/assets/history/route.ts](src/app/api/assets/history/route.ts), add:

```typescript
import { getAuthenticatedUser } from '@/lib/api-auth';
```

At the top of the `GET` handler body:

```typescript
const user = await getAuthenticatedUser(request);
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

---

## Task 7: Add auth guard to `/api/assets/search-crypto`

**Files:**
- Modify: `src/app/api/assets/search-crypto/route.ts`

**Step 1: Add the import and auth check**

In [src/app/api/assets/search-crypto/route.ts](src/app/api/assets/search-crypto/route.ts), add:

```typescript
import { getAuthenticatedUser } from '@/lib/api-auth';
```

At the top of the `GET` handler body:

```typescript
const user = await getAuthenticatedUser(request);
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

---

## Task 8: Add auth guard to `/api/assets/prices-crypto`

**Files:**
- Modify: `src/app/api/assets/prices-crypto/route.ts`

**Step 1: Add the import and auth check**

In [src/app/api/assets/prices-crypto/route.ts](src/app/api/assets/prices-crypto/route.ts), add:

```typescript
import { getAuthenticatedUser } from '@/lib/api-auth';
```

At the top of the `GET` handler body:

```typescript
const user = await getAuthenticatedUser(request);
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

---

## Task 9: Update frontend API call helper to include auth token

**Context:** After adding the 401 guard, the frontend `fetch()` calls to `/api/assets/*` must include the `Authorization: Bearer <token>` header. Find where these are called and add the token.

**Files to check:**
- `src/lib/market-prices.ts`
- Any component that calls `/api/assets/`

**Step 1: Find all API calls to /api/assets/**

```bash
grep -r "api/assets" src/ --include="*.ts" --include="*.tsx" -l
```

**Step 2: Update each call to include the Supabase session token**

The pattern for every `fetch('/api/assets/...')` call should become:

```typescript
import { supabase } from '@/lib/supabase';

// Get the current session token
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

const response = await fetch('/api/assets/prices?symbols=AAPL', {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
```

If the call is inside a React component or hook, use `supabase.auth.getSession()` once at call time (not stored in state, as it auto-refreshes).

**Step 3: Typecheck**

```bash
npm run typecheck
```

**Step 4: Build check**

```bash
npm run build
```

Expected: build passes with no errors.

---

## Task 10: Final commit

**Step 1: Stage all changed files**

```bash
git add supabase/migrations/20260221100001_enable_rls_legacy_tables.sql
git add supabase/migrations/20260221100002_add_coingecko_id_index.sql
git add src/lib/api-auth.ts
git add src/app/api/assets/search/route.ts
git add src/app/api/assets/prices/route.ts
git add src/app/api/assets/history/route.ts
git add src/app/api/assets/search-crypto/route.ts
git add src/app/api/assets/prices-crypto/route.ts
git add src/lib/market-prices.ts  # (if modified in Task 9)
```

**Step 2: Commit**

```bash
git commit -m "security: enable RLS on legacy tables, auth-guard API routes, add coingecko index"
```

---

## Verification Checklist

Run through these after completing all tasks:

- [ ] `npx supabase migration list` — both new migrations show as applied
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — build succeeds
- [ ] App login still works (users table RLS allows own row)
- [ ] Monthly dashboard loads categories correctly (global defaults visible)
- [ ] Investment allocations load correctly
- [ ] Asset search works from the portfolio page (auth token included in fetch)
- [ ] Supabase Advisor → Security tab: no more RLS warnings on the 5 tables
- [ ] Calling `/api/assets/prices?symbols=AAPL` without Authorization header → HTTP 401

---

## Rollback Plan (if needed)

If RLS breaks something in production, the quick rollback is:

```sql
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_allocations DISABLE ROW LEVEL SECURITY;
```

Run this in the Supabase SQL Editor (not as a migration). This restores the pre-fix state in seconds without touching any data.
