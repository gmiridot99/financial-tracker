-- Migration: Add non-negative balance constraints to account tables
-- These constraints enforce that account balances cannot go negative,
-- providing a database-level safety net beyond the client-side checks

-- Savings accounts cannot have negative balances
ALTER TABLE savings_accounts
  ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);

-- Investment accounts cannot have negative cash balances
ALTER TABLE investment_accounts
  ADD CONSTRAINT cash_balance_non_negative CHECK (cash_balance >= 0);
