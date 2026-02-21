# Account Flow Redesign — Design Document

**Date:** 2026-02-21
**Status:** Approved for implementation

---

## Context

The app currently tracks income and expenses in a ledger, computes a monthly surplus, and lets the user deposit it to the primary account at end-of-month ("Chiudi mese"). Account balances update only at that point. This creates a disconnect between what you record and what your accounts actually show.

The new model makes every financial event immediately update account balances:
- **Income** → credits a designated savings account (default: primary)
- **Expense** → debits a designated savings account (default: primary)
- **Transfer** → moves money between accounts (savings↔savings or savings→investment), invisible to P&L

This replaces the surplus/deposit flow with real-time account tracking, and replaces the special Investimenti/Risparmi expense categories with explicit transfers.

---

## Approach: Separate `transfers` Table (Approach B)

The `transactions` table remains for true income/expenses only. A new `transfers` table handles all inter-account movements. Dashboard P&L ignores transfers; account balances update immediately on every event.

---

## Data Model

### New table: `transfers`

```sql
CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  note TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT CHECK (frequency IN ('monthly', 'weekly', 'yearly')),
  trigger_pac BOOLEAN NOT NULL DEFAULT false,

  -- Source: always a savings account
  from_savings_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,

  -- Destination: exactly one must be set
  to_savings_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,
  to_investment_account_id UUID REFERENCES investment_accounts(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT exactly_one_destination CHECK (
    (to_savings_account_id IS NOT NULL)::int +
    (to_investment_account_id IS NOT NULL)::int = 1
  )
);

-- RLS
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY transfers_user ON transfers USING (user_id = auth.uid());

-- Idempotency for recurring imports
CREATE UNIQUE INDEX transfers_recurring_dedup ON transfers (
  user_id,
  from_savings_account_id,
  COALESCE(to_savings_account_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(to_investment_account_id, '00000000-0000-0000-0000-000000000000'),
  date
) WHERE is_recurring = true;
```

### Modified: `transactions`

Two new nullable columns (backward compatible):
```sql
ALTER TABLE transactions
  ADD COLUMN from_savings_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,
  ADD COLUMN to_savings_account_id   UUID REFERENCES savings_accounts(id) ON DELETE SET NULL;
```

- **Income**: `to_savings_account_id` = destination account (default: primary)
- **Expense**: `from_savings_account_id` = source account (default: primary)
- Old columns `investment_account_id`, `savings_account_id`, `trigger_pac` kept for historical backward compatibility, not used for new transactions

### Balance constraints (new)

```sql
ALTER TABLE savings_accounts    ADD CONSTRAINT balance_non_negative     CHECK (balance >= 0);
ALTER TABLE investment_accounts ADD CONSTRAINT cash_balance_non_negative CHECK (cash_balance >= 0);
```

### TypeScript types to add (`src/types/database.ts`)

```typescript
interface Transfer {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  note?: string;
  is_recurring: boolean;
  frequency?: 'monthly' | 'weekly' | 'yearly';
  trigger_pac: boolean;
  from_savings_account_id?: string;
  to_savings_account_id?: string;
  to_investment_account_id?: string;
  created_at: string;
}

// Updated Transaction — new optional fields
interface Transaction {
  // ... existing fields ...
  from_savings_account_id?: string; // for expenses
  to_savings_account_id?: string;   // for income
}
```

---

## Money Flow Logic

| Event | Effect |
|---|---|
| Add income | `savings_accounts.balance += amount` (to_savings_account_id) |
| Add expense | Check balance ≥ amount → `savings_accounts.balance -= amount` (from_savings_account_id) |
| Add savings→savings transfer | source balance -= amount; dest balance += amount |
| Add savings→investment transfer | savings balance -= amount; investment cash_balance += amount |
| Delete/edit any record | rollback delta to original value (existing atomic pattern) |

**Negative balance**: blocked client-side with user-friendly error. Also enforced at DB level via CHECK constraint. Error message: *"Saldo insufficiente sul conto X (disponibile: 150€, richiesti: 200€)"*

**Atomic pattern** (reusing existing hooks):
```
1. INSERT record
   └─ DUPLICATE CONSTRAINT → skip (already imported this month)
   └─ success → update account balance(s)
      └─ failure → DELETE inserted record (rollback)
      └─ if trigger_pac → execute PAC rules
```

---

## Dashboard Changes

### P&L calculation (no more surplus/Chiudi mese)

```
totalIncome    = SUM income transactions for month
totalExpenses  = SUM expense transactions for month (NO Investimenti/Risparmi)
cashFlow       = totalIncome - totalExpenses  (analytics only, accounts already updated)
```

Transfers have their own "Movimenti del mese" section below P&L — not included in totals.

### Removed
- "Chiudi mese" / "Deposita nel conto principale" button
- InlineSavingsForm (replaced by TransferForm)
- Investimenti and Risparmi from expense category list

### Added
- "Dal conto" chip selector on expense form (default: primary)
- "Al conto" chip selector on income form (default: primary)
- New `TransferForm` inline component
- "Movimenti del mese" section listing transfers (read-only summary)
- "⇄ Trasferisci" action button alongside [+ Entrata] [- Uscita]

---

## Recurring Transactions & Transfers

"Importa ricorrenti" button now handles both tables:

1. **Recurring transactions** (income/expense): same as today — INSERT with dedup constraint → update account balance
2. **Recurring transfers** (NEW): copy from `transfers` WHERE `is_recurring=true` AND previous month → INSERT with dedup index → update source & dest balances → optionally execute PAC

The same atomic pattern (insert → balance update → rollback on failure) applies to both.

---

## Forms / UX

### Modified: `InlineTransactionForm` (expense)
- Add "Dal conto" chip selector (savings accounts, primary preselected)
- Remove Investimenti and Risparmi from category options
- On submit: check `balance >= amount` → insert transaction + decrement account balance

### Modified: `InlineIncomeForm`
- Add "Al conto" chip selector (savings accounts, primary preselected)
- On submit: insert transaction + increment account balance

### New: `TransferForm` (`src/components/TransferForm.tsx`)
- "Da" chip selector → savings accounts only
- "A" chip selector → savings accounts + investment accounts (visually grouped)
- Amount, date, note
- "Ricorrente" toggle → frequency selector (monthly/weekly/yearly)
- "Esegui PAC dopo" toggle (only when dest = investment account)
- Validation: source balance ≥ amount

### Simplified: `InvestmentForm`
- Removes funding flow (that's now TransferForm)
- Retains: buy, sell, manual adjustment of holdings within the account

### Dashboard action bar
```
[+ Entrata]   [- Uscita]   [⇄ Trasferisci]
```

---

## Migration Path

### DB migrations (sequential)

1. `20260221000001_create_transfers.sql` — create transfers table + RLS + unique index
2. `20260221000002_add_account_fks_to_transactions.sql` — add from/to savings columns to transactions
3. `20260221000003_add_balance_constraints.sql` — add CHECK balance >= 0 to accounts

### Data backfill (optional, cosmetic)

```sql
-- Income → to_savings = primary account
UPDATE transactions t
SET to_savings_account_id = (
  SELECT id FROM savings_accounts WHERE user_id = t.user_id AND is_primary = true LIMIT 1
)
WHERE type = 'income' AND to_savings_account_id IS NULL;

-- Expenses (non-Investimenti, non-Risparmi) → from_savings = primary account
UPDATE transactions t
SET from_savings_account_id = (
  SELECT id FROM savings_accounts WHERE user_id = t.user_id AND is_primary = true LIMIT 1
)
WHERE type = 'expense'
  AND from_savings_account_id IS NULL
  AND investment_account_id IS NULL
  AND savings_account_id IS NULL;
```

Historical Investimenti/Risparmi expense transactions remain unchanged (kept as historical records).

### What does NOT change

| Component | Status |
|---|---|
| `wealth_snapshots` + `updateWealthSnapshotFromAccounts()` | Unchanged |
| `investment_transactions` (buy/sell/holdings) | Unchanged |
| `pac_rules` | Unchanged — trigger_pac moves to transfers table |
| Annual recap / multi-year charts | Unchanged |
| Simulator | Unchanged |
| `computeMonthDelta()` in wealth.ts | Minor update: also reads transfers for historical delta calc |

---

## Files to Modify

### New files
- `supabase/migrations/20260221000001_create_transfers.sql`
- `supabase/migrations/20260221000002_add_account_fks_to_transactions.sql`
- `supabase/migrations/20260221000003_add_balance_constraints.sql`
- `src/components/TransferForm.tsx`
- `src/hooks/useTransfers.ts`

### Modified files
- `src/types/database.ts` — add Transfer type, update Transaction
- `src/components/InlineTransactionForm.tsx` — add from_account chip selector, remove Investimenti/Risparmi
- `src/components/InlineIncomeForm.tsx` (or create InlineIncomeForm if not exists) — add to_account chip selector
- `src/app/dashboard/[year]/[month]/page.tsx` — remove surplus/Chiudi mese, add Movimenti section, add Trasferisci button
- `src/lib/recurring.ts` — extend to copy recurring transfers
- `src/lib/wealth.ts` — update computeMonthDelta to include transfers
- `src/components/InvestmentForm.tsx` — remove funding flow

---

## Verification

1. **Unit tests**: `useTransfers` hook — atomic deposit, rollback on balance failure, negative balance rejection
2. **Integration**: add income → verify savings account balance increments
3. **Integration**: add expense → verify savings account balance decrements; test rejection when balance insufficient
4. **Integration**: add savings→investment transfer → verify savings decrements, investment cash_balance increments
5. **Recurring**: click "Importa ricorrenti" → verify transfers copied + balances updated; click again → verify idempotent (no double-deduction)
6. **PAC**: recurring transfer with trigger_pac=true → verify PAC executes on import
7. **Wealth tracking**: verify wealth_snapshots still computed correctly from account balances
8. **Typecheck + build**: `npm run check` passes
