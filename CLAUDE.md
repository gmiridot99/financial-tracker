# Financial Life Planner

## Project Overview

Web app per la gestione finanziaria personale che collega le abitudini mensili agli obiettivi di vita a lungo termine. Costruita con Next.js 14+ (App Router), TypeScript, Supabase e Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 14+ (App Router) con TypeScript strict mode
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS con warm color palette custom
- **Validation**: Zod schemas
- **Testing**: Vitest
- **Charts**: Recharts
- **Date**: date-fns (locale italiano)
- **Notifications**: react-hot-toast
- **Icons**: lucide-react

## Project Structure

```
src/
  app/
    layout.tsx                          # Root layout + AuthProvider + Toaster
    page.tsx                            # Homepage (redirect to login/dashboard)
    login/page.tsx                      # Login
    register/page.tsx                   # Registration
    settings/page.tsx                   # User settings (savings/investments split)
    dashboard/
      page.tsx                          # Redirect to current month
      [year]/[month]/page.tsx           # Monthly dashboard (main page)
      [year]/recap/page.tsx             # Annual recap
      simulator/page.tsx                # Financial simulator
  components/
    TransactionCard.tsx                 # Transaction display card (with selection mode)
    TransactionModal.tsx                # Add/Edit/Delete transactions modal
    InlineTransactionForm.tsx           # Inline expense form
    InlineIncomeForm.tsx                # Inline income form (green theme)
    InvestmentForm.tsx                  # Investment transaction form
    BulkDeleteActionBar.tsx             # Floating bar for bulk delete
    WealthModal.tsx                     # Manual wealth input modal
    AllocationBar.tsx                   # Allocation visualization
    CountUp.tsx                         # Animated number counter
    AnnualTrendChart.tsx                # Annual trend chart (income/expenses/investments/wealth)
    AnnualInsights.tsx                  # 6 summary cards for annual recap
    CategoryBreakdownChart.tsx          # Donut chart for expense categories
    MonthlyFlowChart.tsx                # Monthly cash flow chart
    MultiYearTrendChart.tsx             # Multi-year comparison
    YearComparisonCards.tsx             # Year-over-year comparison
    simulator/
      MilestoneTable.tsx                # Milestone grid with dynamic expense rows
      DebtCard.tsx                      # Debt display card
      InlineDebtForm.tsx                # Inline debt form
      DebtsList.tsx                     # Debts container
      SimulatorChart.tsx                # Multi-layer simulation chart (Recharts ComposedChart)
      ResultsSummary.tsx                # Simulation results cards
      MilestonesCards.tsx               # Wealth milestone tracking + warnings
      ExportButton.tsx                  # Export (TXT/CSV/JSON/clipboard)
  contexts/
    AuthContext.tsx                      # Auth state (signUp, signIn, signOut)
  lib/
    supabase.ts                         # Supabase client config
    calculations.ts                     # Financial calculations (net, savings, investments)
    recurring.ts                        # Recurring transactions (manual copy from previous month)
    wealth.ts                           # Wealth tracking (snapshots, accumulation, carry-forward)
    dateUtils.ts                        # Date helpers (day clamping for short months)
    simulator/
      types.ts                          # Simulator type definitions
      simulator.ts                      # Main simulation engine (milestone-based)
      calculations.ts                   # Math functions + linear interpolation
      phases.ts                         # Phase management
      events.ts                         # Purchase/sale events
      assets.ts                         # Asset management + appreciation
      debts.ts                          # Debt amortization (French method)
  types/
    database.ts                         # TypeScript types for all DB tables
supabase/migrations/                    # SQL migration files (apply in order)
```

## Database Schema

### Tables
1. **users** - id, email, password_hash, created_at
2. **user_settings** - savings_percentage (default 40), investments_percentage (default 60), currency EUR
3. **categories** - 15 default seeded (5 income + 10 expense), supports custom per user
4. **transactions** - type (income/expense), amount, category, is_recurring, frequency, start_date
5. **investment_categories** - Azioni (7%), Obbligazioni (3%), Liquidita (1%)
6. **investment_allocations** - Monthly investment distribution snapshots
7. **wealth_snapshots** - Monthly patrimony (investments_balance, savings_balance, is_manual)

### Key Constraints
- `user_settings`: savings + investments = 100
- `transactions`: amount > 0, partial unique index on recurring transactions prevents duplicates
- `wealth_snapshots`: UNIQUE (user_id, year, month)

## Tailwind Custom Tokens

```
Backgrounds:  bg-warmBg-primary | bg-warmBg-secondary | bg-warmBg-tertiary | bg-warmBg-hover
Text:         text-warmText-primary | text-warmText-secondary | text-warmText-tertiary
Data colors:  warmData-income (green) | warmData-expense (red) | warmData-investment (purple) | warmData-savings (blue)
Accent:       bg-warmAccent-primary | bg-warmAccent-hover
Shapes:       rounded-2xl (cards) | rounded-xl (inputs) | rounded-lg (buttons)
Heights:      h-11 (inputs)
Animation:    animate-cardEnter
```

## Key Patterns & Best Practices

### Database
- **Always use RLS**: Include `eq('user_id', user.id)` in all queries
- **Duplicate prevention**: Use database constraints (partial unique indexes), NOT application-level checks. Handle PostgreSQL error code `23505` gracefully
- **Upsert**: Use `onConflict` parameter for upsert operations
- **Migrations**: Apply in order via Supabase SQL Editor or `supabase db push`

### Recurring Transactions
- **Manual-only**: No automatic generation. User clicks "Importa ricorrenti" to copy from previous month
- `copyRecurringFromPreviousMonth()` handles the copy. Database constraint makes it idempotent

### Financial Calculations
- **Use actual transaction data**, never hardcoded formulas (past bug: used `net * 0.6` instead of filtering by category)
- Investment transactions: filter by `category_name === 'Investimenti'`, not by type
- Wealth accumulation: base (previous month) + monthly transactions = total (carry-forward)
- Round to 2 decimal places for currency values

### Date Handling
- **UI**: Italian format (dd/MM/yyyy) via date-fns locale `it`
- **Database**: ISO 8601 (YYYY-MM-DD)
- **Day clamping**: Use `getValidDateForMonth()` for short months (Jan 31 -> Feb 28)
- Always use `endOfMonth()` from date-fns, never hardcode day 31

### Forms
- European decimal support: accept both comma and dot
- Zod validation on all forms
- Toast notifications for feedback
- Modal pre-fills when editing existing data

### Simulator
- Milestone-based: year 5/10/15/20/30 with linear interpolation
- Dynamic expense rows per milestone (array of ExpenseRow)
- French amortization for mortgages
- Asset withdrawal priority: Savings -> Investments
- Inflation: `realValue = nominalValue / (1 + inflationRate)^years`
- Supports N parallel debts, sale events with surplus distribution

### Security
- Only `anon/public` key in frontend, never `service_role`
- `.env.local` gitignored, `.env.example` as template
- All queries include user_id check
- Confirmation dialogs before destructive actions

## Bugs Fixed (Lessons Learned)

1. **Recurring duplicates**: Race conditions caused exponential duplication. Fixed with database partial unique index + constraint violation handling (code 23505). Later simplified to manual-only system
2. **Short month dates**: Hardcoded `-31` suffix caused invalid dates. Fixed with `endOfMonth()` and day clamping
3. **Phantom investments in recap**: Used `net * 0.6` formula instead of actual transactions. Fixed by filtering `category_name === 'Investimenti'`
4. **Form default date overflow**: Viewing February on Jan 31st created invalid date. Fixed with `getValidDateForMonth()`
5. **Simulator immutability**: `appreciateAssets()` and `updateDebts()` mutated objects. Fixed by creating new objects

## Commands

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm test             # Run tests
npm run typecheck    # TypeScript check
npm run check        # Typecheck + tests
```

## Ralph Agent System

Ralph is an autonomous development agent that works through user stories in `prd.json`.

### How it works
1. Reads `prd.json`, finds next incomplete story (passes=false, lowest priority)
2. Implements the story completely
3. Updates `prd.json` (passes=true) and appends to `progress.txt`
4. Repeats until all stories are complete, then outputs `<promise>COMPLETE</promise>`

### Critical Rules
- Work on ONE story at a time
- NEVER skip stories or change their order
- ALL acceptance criteria must be satisfied
- Write actual working code, not pseudo-code or TODOs

### Key files
- `prd.json` - User stories with status
- `progress.txt` - Append-only work log
