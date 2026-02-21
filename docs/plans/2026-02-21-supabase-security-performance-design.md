# Supabase Security & Performance — Design Doc

**Date**: 2026-02-21
**Approach**: B (staged fix — no data deletion, no table drops)
**Status**: Approved

---

## Context

Supabase Advisor is flagging security warnings on this project. Analysis of all 23 migration files and 5 API routes revealed the following issues.

---

## Issues Found

### 🔴 Critical Security: RLS Missing on Core Tables

Five tables created in the earliest migrations have **RLS disabled**. Any authenticated user can read/write other users' data via the Supabase client directly (bypassing application-level filters).

| Table | Migration | RLS Status | Risk |
|---|---|---|---|
| `users` | 20260129000001 | ❌ disabled | User PII readable by anyone |
| `user_settings` | 20260129000001 | ❌ disabled | Settings readable/writable by anyone |
| `categories` | 20260129000002 | ❌ disabled | Custom categories exposed |
| `investment_categories` | 20260129000004 | ❌ disabled | Custom categories exposed |
| `investment_allocations` | 20260129000004 | ❌ disabled | Financial allocations exposed |

Note: `categories` and `investment_categories` have rows with `user_id IS NULL` (global defaults seeded at migration time). RLS policies must allow reading these null-user rows.

Tables added in later migrations (savings_accounts, wealth_snapshots, pac_rules, transfers, etc.) already have RLS correctly enabled.

### 🔴 Security: Unauthenticated API Routes

All 5 Next.js API routes under `/api/assets/` accept requests without verifying the caller is authenticated:

- `GET /api/assets/search` — proxies Yahoo Finance search
- `GET /api/assets/prices` — reads/writes `asset_prices_cache` via **service role key**
- `GET /api/assets/history` — reads `asset_price_history` via service role key
- `GET /api/assets/search-crypto` — proxies CoinGecko search
- `GET /api/assets/prices-crypto` — reads/writes cache via service role key

The service role key bypasses RLS entirely. An unauthenticated caller can trigger writes to the shared cache.

### 🟡 Performance: Missing Index on `asset_prices_cache.coingecko_id`

The crypto prices route queries:
```sql
SELECT ... FROM asset_prices_cache WHERE coingecko_id IN (...)
```
There is no index on `coingecko_id` — this is a full table scan on every crypto price fetch.

The `asset_prices_cache` table has a `UNIQUE` constraint on `symbol` (used as the primary lookup key for stocks), but `coingecko_id` (used for crypto) has no index.

---

## Out of Scope (not included in this plan)

The following were identified but excluded to minimize production risk:

- Dropping `password_hash` column from `users` (nullable, unused — low risk but DROP on prod)
- Removing redundant single-column indexes on `transactions.type` and `transactions.is_recurring`
- Optimizing EUR/USD fetch in `/api/assets/prices` (always fetched even when all prices cached)
- Restricting `asset_prices_cache` / `asset_price_history` write policies further

---

## Solution Design

### Step 1: Migration — RLS on legacy tables

**File**: `supabase/migrations/20260221100001_enable_rls_legacy_tables.sql`

Actions (all ADD-only, no data touched):

1. `ALTER TABLE users ENABLE ROW LEVEL SECURITY`
   - Policy SELECT: `id = auth.uid()`
   - Policy UPDATE: `id = auth.uid()`
   - No INSERT/DELETE (users created via trigger, never directly)

2. `ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY`
   - Policy ALL: `user_id = auth.uid()`

3. `ALTER TABLE categories ENABLE ROW LEVEL SECURITY`
   - Policy SELECT: `user_id = auth.uid() OR user_id IS NULL` (includes global defaults)
   - Policy INSERT/UPDATE/DELETE: `user_id = auth.uid()` (only own custom categories)

4. `ALTER TABLE investment_categories ENABLE ROW LEVEL SECURITY`
   - Same as categories (global rows have `user_id IS NULL`)

5. `ALTER TABLE investment_allocations ENABLE ROW LEVEL SECURITY`
   - Policy ALL: `user_id = auth.uid()`

### Step 2: Migration — Performance index

**File**: `supabase/migrations/20260221100002_add_coingecko_id_index.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_asset_prices_cache_coingecko_id
  ON asset_prices_cache(coingecko_id)
  WHERE coingecko_id IS NOT NULL;
```

### Step 3: API route auth guard

Add Supabase JWT verification to all 5 `/api/assets/*` handlers.

Pattern: read `Authorization: Bearer <token>` header, create a user-scoped Supabase client (not service role) to verify the session. If no valid session → return 401. The cache read/write operations that require service role still use the service role client, but only after confirming the caller is authenticated.

---

## Constraints

- **No DROP TABLE, DROP COLUMN, DELETE, TRUNCATE**
- **No data modification**
- All migration statements use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- Production-safe: RLS enable on a table with existing data is instant (no lock, no rewrite)
- Enabling RLS without policies = table becomes inaccessible → policies must be created in the same migration

---

## Verification Checklist

After applying:
- [ ] `npm run typecheck` — no TypeScript errors
- [ ] `npm run build` — build passes
- [ ] Login still works (users table readable for own row)
- [ ] Categories still load (global + own)
- [ ] Monthly dashboard loads transactions
- [ ] Investment allocations load
- [ ] `/api/assets/prices?symbols=AAPL` returns 401 when called without auth header
- [ ] Supabase Advisor: no more RLS warnings on the 5 tables
