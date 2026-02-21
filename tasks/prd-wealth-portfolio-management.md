# PRD: Wealth & Portfolio Management Page

## Introduction

Nuova pagina "Patrimonio" che raccoglie gli ammontari mensili di risparmi e investimenti dal tracker e li organizza in conti dedicati. I fondi non ancora assegnati vengono visualizzati come "Non destinati". L'utente puo' creare conti risparmio con regole di distribuzione automatica (percentuali fisse) e conti investimento con tracking di asset reali (azioni, ETF, crypto, commodity) tramite Yahoo Finance e CoinGecko. I mesi negativi nel tracker si sottraggono proporzionalmente da tutti i conti risparmio.

## Goals

- Dare visibilita' completa su dove finiscono risparmi e investimenti ogni mese
- Permettere la creazione di conti risparmio nominati con allocazione manuale e automatica (percentuali fisse)
- Permettere la creazione di conti investimento con tracking di asset finanziari reali
- Integrare Yahoo Finance e CoinGecko per prezzi live con auto-refresh
- Calcolare gain/loss realizzato e non realizzato per ogni posizione
- Sottrarre proporzionalmente i mesi negativi dai conti risparmio
- Permettere vendita di asset con redistribuzione dei proventi verso risparmi o "Non destinati"

## Data Flow

```
Monthly Tracker (income - expenses)
        |
        v
  Net > 0 ? ---> Split via user_settings (es. 40% savings, 60% investments)
        |
   [Savings Amount]          [Investment Amount]
        |                           |
        v                           v
  "Non destinati               "Non destinati
    Risparmi"                   Investimenti"
        |                           |
  (Manual / Auto %)           (Manual allocation)
        |                           |
        v                           v
  [Conto A] [Conto B]...     [Conto X] [Conto Y]...
                                    |
                              Buy/Sell Assets
                              (Yahoo Finance + CoinGecko)

  Net < 0 ? ---> Deficit sottratto PROPORZIONALMENTE da tutti i conti risparmio
```

## User Stories

### US-001: Create savings-related database tables
**Description:** As a developer, I need database tables to store savings accounts, auto-allocation rules, and transfer history.

**Acceptance Criteria:**
- [ ] Create `savings_accounts` table: id (UUID PK), user_id (FK), name (TEXT NOT NULL), balance (NUMERIC(12,2) DEFAULT 0), created_at, sort_order (INT DEFAULT 0)
- [ ] Create `savings_auto_rules` table: id (UUID PK), user_id (FK), savings_account_id (FK to savings_accounts), percentage (NUMERIC(5,2) NOT NULL), is_active (BOOLEAN DEFAULT true), created_at
- [ ] Create `savings_transfers` table: id (UUID PK), user_id (FK), from_account_id (UUID nullable, NULL = "Non destinati"), to_account_id (UUID nullable, NULL = "Non destinati"), amount (NUMERIC(12,2) NOT NULL), note (TEXT), created_at
- [ ] Add RLS policies: all tables filtered by user_id
- [ ] Add check constraint: savings_auto_rules.percentage between 0 and 100
- [ ] Add foreign keys with ON DELETE CASCADE
- [ ] Migration runs successfully
- [ ] Typecheck passes

### US-002: Create investment-related database tables
**Description:** As a developer, I need database tables to store investment accounts, asset transactions, and price cache.

**Acceptance Criteria:**
- [ ] Create `investment_accounts` table: id (UUID PK), user_id (FK), name (TEXT NOT NULL), cash_balance (NUMERIC(12,2) DEFAULT 0), created_at, sort_order (INT DEFAULT 0)
- [ ] Create `investment_transactions` table: id (UUID PK), user_id (FK), investment_account_id (FK), asset_symbol (TEXT NOT NULL), asset_name (TEXT NOT NULL), asset_type (TEXT NOT NULL: 'stock'|'etf'|'crypto'|'commodity'|'bond'), transaction_type (TEXT NOT NULL: 'buy'|'sell'), quantity (NUMERIC(18,8)), price_per_unit (NUMERIC(18,8)), total_amount (NUMERIC(12,2)), currency (TEXT DEFAULT 'EUR'), transaction_date (DATE), created_at
- [ ] Create `asset_prices_cache` table: id (UUID PK), symbol (TEXT UNIQUE NOT NULL), asset_type (TEXT NOT NULL), current_price (NUMERIC(18,8)), price_currency (TEXT DEFAULT 'USD'), last_updated (TIMESTAMPTZ)
- [ ] Add RLS policies on investment_accounts and investment_transactions (asset_prices_cache is shared/public)
- [ ] Add check constraints: quantity > 0, price_per_unit > 0, total_amount > 0
- [ ] 8 decimal places for quantity and price to support crypto fractional units
- [ ] Migration runs successfully
- [ ] Typecheck passes

### US-003: Create unallocated balances table and sync logic
**Description:** As a developer, I need to track how much savings and investment money is unallocated ("Non destinati") per user, synced from the monthly tracker.

**Acceptance Criteria:**
- [ ] Create `unallocated_balances` table: id (UUID PK), user_id (FK, UNIQUE), savings_unallocated (NUMERIC(12,2) DEFAULT 0), investments_unallocated (NUMERIC(12,2) DEFAULT 0), updated_at (TIMESTAMPTZ)
- [ ] Create utility function `recalculateUnallocated(userId)` in `src/lib/wealth-accounts.ts`
- [ ] Function calculates: total monthly savings (sum across all months) minus sum of all savings_accounts balances = savings_unallocated
- [ ] Function calculates: total monthly investments minus (sum of all investment_accounts cash_balance + sum of all investment_transactions buy amounts - sell amounts) = investments_unallocated
- [ ] Uses existing `calculateMonthlySummary()` data from monthly tracker as source of truth
- [ ] Negative months (net < 0): the absolute deficit value is tracked and subtracted from savings total
- [ ] Upserts result to unallocated_balances table
- [ ] RLS policy filtered by user_id
- [ ] Migration runs successfully
- [ ] Typecheck passes
- [ ] Tests pass for recalculation logic

### US-004: Wealth page layout with tabs and unallocated display
**Description:** As a user, I want a dedicated "Patrimonio" page where I can see my unallocated savings and investments and manage my accounts.

**Acceptance Criteria:**
- [ ] Create page at `/dashboard/patrimonio`
- [ ] Page header: "Patrimonio" with back button to monthly dashboard
- [ ] Two prominent cards at top: "Non destinati - Risparmi" (blue) and "Non destinati - Investimenti" (purple) showing unallocated amounts
- [ ] Two tab sections below: "Risparmi" and "Investimenti" switchable via tab bar
- [ ] Auth-protected: redirects to /login if unauthenticated
- [ ] Loading state while fetching data
- [ ] Add navigation link to patrimonio page from monthly dashboard header
- [ ] Design matches warm Revolut-style theme
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Create and manage savings accounts
**Description:** As a user, I want to create named savings accounts so I can organize my savings by purpose (e.g., "Fondo emergenza", "Vacanze", "Casa").

**Acceptance Criteria:**
- [ ] "Nuovo conto risparmio" button opens inline form or modal
- [ ] Form requires only account name (TEXT, min 1 char)
- [ ] Created account appears as card with name and balance (initially 0.00)
- [ ] Edit account name via pencil icon
- [ ] Delete account only if balance is 0 (show warning otherwise, offer to move funds first)
- [ ] Accounts displayed as card list sorted by sort_order then created_at
- [ ] Empty state: "Nessun conto risparmio. Crea il primo!"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Manual allocation from unallocated to savings accounts
**Description:** As a user, I want to manually move money from "Non destinati" to my savings accounts.

**Acceptance Criteria:**
- [ ] Each savings account card has "Deposita" button
- [ ] Clicking opens input for amount (with European decimal support: comma and dot)
- [ ] Validation: amount > 0, amount <= savings_unallocated balance
- [ ] On confirm: decreases unallocated savings, increases target account balance
- [ ] Creates entry in savings_transfers (from_account_id = NULL, to_account_id = target)
- [ ] Balances update immediately in UI without page refresh
- [ ] Toast notification on success/error
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Transfer between savings accounts
**Description:** As a user, I want to move money between my savings accounts and back to "Non destinati".

**Acceptance Criteria:**
- [ ] Each savings account card has "Trasferisci" button
- [ ] Opens modal/form with: amount input, destination dropdown (other accounts + "Non destinati")
- [ ] Validation: amount > 0, amount <= source account balance
- [ ] On confirm: decreases source balance, increases destination balance (or unallocated)
- [ ] Creates entry in savings_transfers with both from/to account IDs
- [ ] All balances update immediately in UI
- [ ] Toast notification on success
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Auto-allocation rules for savings
**Description:** As a user, I want to set percentage rules so that each month my unallocated savings are automatically distributed to my accounts (e.g., 60% Fondo emergenza, 40% Vacanze).

**Acceptance Criteria:**
- [ ] "Regole automatiche" button/section on savings tab
- [ ] For each savings account: percentage input (0-100) with toggle on/off
- [ ] Validation: sum of active percentages must be <= 100 (remainder stays in "Non destinati")
- [ ] Rules saved to savings_auto_rules table (upsert per account)
- [ ] Display current rules with account names and percentages
- [ ] "Applica ora" button to manually trigger distribution on current unallocated balance
- [ ] Toast showing how much was distributed to each account
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Auto-apply savings rules on monthly data change
**Description:** As a developer, I need the auto-allocation rules to execute when new monthly savings data flows in.

**Acceptance Criteria:**
- [ ] Create `applyAutoAllocationRules(userId)` function in `src/lib/wealth-accounts.ts`
- [ ] Function queries active rules (is_active = true) for user
- [ ] Calculates amount per account: unallocated * (percentage / 100)
- [ ] Only runs if unallocated > 0
- [ ] Creates savings_transfers entries for each allocation
- [ ] Updates account balances and unallocated balance atomically
- [ ] Function is called when patrimonio page loads (checks if new unallocated funds exist since last auto-apply)
- [ ] Track last_auto_applied timestamp to avoid double-applying
- [ ] Rounds to 2 decimal places
- [ ] Typecheck passes
- [ ] Tests pass

### US-010: Negative month proportional deduction from savings
**Description:** As a user, when I have a negative month (expenses > income), the deficit should be proportionally deducted from all my savings accounts.

**Acceptance Criteria:**
- [ ] Create `applyNegativeMonthDeduction(userId, deficit)` function in `src/lib/wealth-accounts.ts`
- [ ] Queries all savings accounts with balance > 0 for user
- [ ] Calculates total savings across all accounts
- [ ] Each account's deduction = deficit * (account_balance / total_savings)
- [ ] If total savings < deficit: drain all accounts to 0, remaining deficit reduces unallocated (can go negative)
- [ ] Creates savings_transfers entries (from each account, to_account_id = NULL, note = "Deduzione mese negativo MM/YYYY")
- [ ] Updates all account balances atomically
- [ ] Deduction is triggered from monthly tracker when net < 0
- [ ] Rounds to 2 decimal places
- [ ] Typecheck passes
- [ ] Tests pass

### US-011: Create and manage investment accounts
**Description:** As a user, I want to create named investment accounts to organize my investments (e.g., "Degiro", "Trading212", "Crypto Wallet").

**Acceptance Criteria:**
- [ ] "Nuovo conto investimento" button opens inline form or modal
- [ ] Form requires only account name
- [ ] Created account appears as card with: name, cash balance (uninvested), holdings value, total value
- [ ] Edit account name via pencil icon
- [ ] Delete account only if cash_balance is 0 AND no holdings (show warning otherwise)
- [ ] Accounts displayed as card list
- [ ] Empty state: "Nessun conto investimento. Crea il primo!"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Manual allocation from unallocated to investment accounts
**Description:** As a user, I want to move money from "Non destinati Investimenti" to my investment accounts as cash.

**Acceptance Criteria:**
- [ ] Each investment account card has "Deposita" button
- [ ] Amount input with validation: amount > 0, amount <= investments_unallocated
- [ ] On confirm: decreases investments_unallocated, increases account cash_balance
- [ ] Balances update immediately in UI
- [ ] Toast notification on success/error
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-013: Transfer between investment accounts
**Description:** As a user, I want to move cash between investment accounts and back to "Non destinati".

**Acceptance Criteria:**
- [ ] Each investment account card has "Trasferisci" button for cash balance
- [ ] Modal with: amount input, destination dropdown (other investment accounts + "Non destinati Investimenti" + "Non destinati Risparmi")
- [ ] Validation: amount > 0, amount <= source account cash_balance
- [ ] Moving to "Non destinati Risparmi" increases savings_unallocated (cross-pool transfer)
- [ ] All balances update immediately
- [ ] Toast notification on success
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-014: Asset search via Yahoo Finance API
**Description:** As a developer, I need a Next.js API route that searches Yahoo Finance for stocks, ETFs, bonds, and commodities.

**Acceptance Criteria:**
- [ ] Create API route: `/api/assets/search?q=QUERY&type=stock|etf|bond|commodity`
- [ ] Calls Yahoo Finance API (via `yahoo-finance2` npm package or direct endpoint)
- [ ] Returns array of results: { symbol, name, type, exchange, currency }
- [ ] Handles rate limits gracefully (retry with backoff or queue)
- [ ] Returns empty array on no results (not an error)
- [ ] API key stored in environment variable (not hardcoded)
- [ ] Error handling: returns 500 with user-friendly message on API failure
- [ ] Typecheck passes
- [ ] Tests pass for response parsing

### US-015: Asset search via CoinGecko API
**Description:** As a developer, I need a Next.js API route that searches CoinGecko for cryptocurrencies.

**Acceptance Criteria:**
- [ ] Create API route: `/api/assets/search-crypto?q=QUERY`
- [ ] Calls CoinGecko free API (`/search` endpoint)
- [ ] Returns array of results: { symbol, name, type: 'crypto', coingecko_id, thumb_image }
- [ ] Handles rate limits (CoinGecko free: 10-30 calls/min) with appropriate delay
- [ ] Returns empty array on no results
- [ ] Error handling: returns 500 with user-friendly message
- [ ] Typecheck passes
- [ ] Tests pass for response parsing

### US-016: Unified asset search UI component
**Description:** As a user, I want to search for any financial asset (stock, ETF, crypto, commodity) from a single search bar when buying in an investment account.

**Acceptance Criteria:**
- [ ] Create `AssetSearchModal` component with search input
- [ ] Debounced search (300ms) calls both Yahoo Finance and CoinGecko APIs in parallel
- [ ] Results displayed in unified list with: icon/type badge, symbol, name, exchange/network
- [ ] Type badges: blue "Stock", green "ETF", orange "Crypto", gray "Bond", brown "Commodity"
- [ ] Loading spinner during search
- [ ] Empty state: "Nessun risultato per 'QUERY'"
- [ ] Clicking a result selects it and opens the buy form (US-017)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-017: Buy asset form (record purchase)
**Description:** As a user, I want to record an asset purchase within an investment account, specifying quantity and price paid.

**Acceptance Criteria:**
- [ ] After selecting asset from search (US-016), show buy form
- [ ] Form fields: quantity (NUMERIC, supports 8 decimals for crypto), price per unit (NUMERIC), total amount (auto-calculated: qty * price), transaction date (default today, Italian format)
- [ ] Validation: quantity > 0, price > 0, total_amount <= account cash_balance
- [ ] On confirm: inserts into investment_transactions (transaction_type = 'buy')
- [ ] Decreases account cash_balance by total_amount
- [ ] Shows purchased asset in account holdings list
- [ ] Toast notification on success
- [ ] European decimal support (comma and dot)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-018: Sell asset form (record sale)
**Description:** As a user, I want to sell (partially or fully) an asset I hold and move the proceeds to cash balance, "Non destinati", or savings.

**Acceptance Criteria:**
- [ ] Each holding in account has "Vendi" button
- [ ] Sell form: quantity to sell (max = current holding quantity), sell price per unit, total proceeds (auto-calculated)
- [ ] Destination dropdown: "Cash nel conto" (default), "Non destinati Investimenti", "Non destinati Risparmi"
- [ ] Validation: sell quantity <= holding quantity, sell price > 0
- [ ] On confirm: inserts into investment_transactions (transaction_type = 'sell')
- [ ] Updates destination balance (cash_balance or unallocated)
- [ ] If full sell (qty = total holding): holding disappears from list
- [ ] Calculates and displays realized gain/loss on the sell transaction
- [ ] Toast notification with realized P&L
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-019: Holdings display with computed positions
**Description:** As a user, I want to see my current holdings per investment account with average buy price, quantity, and current value.

**Acceptance Criteria:**
- [ ] Each investment account card shows list of holdings
- [ ] Each holding row shows: asset symbol, asset name, type badge, quantity held, average buy price, current price (from cache), current value (qty * current_price), unrealized P&L (current_value - cost_basis), P&L percentage
- [ ] Average buy price calculated from all buy transactions minus sell transactions (weighted average)
- [ ] Holdings computed by aggregating investment_transactions: sum buys - sum sells per symbol
- [ ] Holdings with quantity 0 are hidden
- [ ] P&L color: green for profit, red for loss
- [ ] Account total = cash_balance + sum of all holdings current values
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-020: Fetch live prices from Yahoo Finance API
**Description:** As a developer, I need an API route to fetch current prices for stocks/ETFs/bonds/commodities from Yahoo Finance.

**Acceptance Criteria:**
- [ ] Create API route: `/api/assets/prices?symbols=AAPL,MSFT,VWCE.DE`
- [ ] Accepts comma-separated list of symbols
- [ ] Calls Yahoo Finance quote API for batch price fetch
- [ ] Returns map: { [symbol]: { price, currency, change_percent, last_updated } }
- [ ] Updates asset_prices_cache table with fresh prices
- [ ] Handles missing symbols gracefully (returns null for that symbol)
- [ ] Rate limit aware: max 50 symbols per request
- [ ] Typecheck passes
- [ ] Tests pass

### US-021: Fetch live prices from CoinGecko API
**Description:** As a developer, I need an API route to fetch current crypto prices from CoinGecko.

**Acceptance Criteria:**
- [ ] Create API route: `/api/assets/prices-crypto?ids=bitcoin,ethereum,solana`
- [ ] Accepts comma-separated list of CoinGecko IDs
- [ ] Calls CoinGecko `/simple/price` endpoint with vs_currencies=eur,usd
- [ ] Returns map: { [id]: { price_eur, price_usd, change_24h_percent, last_updated } }
- [ ] Updates asset_prices_cache table with fresh prices
- [ ] Respects rate limits (delay between requests if needed)
- [ ] Typecheck passes
- [ ] Tests pass

### US-022: Auto-refresh prices on page load and interval
**Description:** As a user, I want my portfolio values to update automatically when I open the app and periodically while I'm viewing the page.

**Acceptance Criteria:**
- [ ] On patrimonio page load: fetch fresh prices for ALL held assets (batch call)
- [ ] Collect unique symbols from all investment_transactions, split by type (yahoo vs coingecko)
- [ ] Call price APIs in parallel (Yahoo Finance + CoinGecko)
- [ ] Set interval refresh every 5 minutes while page is open
- [ ] Show "Ultimo aggiornamento: HH:mm" timestamp
- [ ] Manual refresh button (circular arrow icon) to force immediate update
- [ ] Loading indicator during price refresh (subtle, not blocking UI)
- [ ] Clear interval on page unmount (cleanup)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-023: Realized and unrealized gain/loss calculations
**Description:** As a user, I want to see my realized P&L (from past sells) and unrealized P&L (from current holdings) per account and overall.

**Acceptance Criteria:**
- [ ] Create `calculatePortfolioMetrics(transactions, currentPrices)` function in `src/lib/portfolio.ts`
- [ ] **Unrealized P&L per holding**: (current_price - avg_buy_price) * quantity_held
- [ ] **Realized P&L per asset**: sum of (sell_price - avg_buy_price_at_time_of_sell) * sell_quantity across all sells
- [ ] Average buy price uses weighted average method (FIFO not required for v1)
- [ ] Per-account summary: total invested (cost basis), current value, total unrealized P&L, total realized P&L
- [ ] Overall portfolio summary across all accounts
- [ ] All values rounded to 2 decimals for EUR amounts
- [ ] Typecheck passes
- [ ] Tests pass with sample transaction data

### US-024: Portfolio summary dashboard section
**Description:** As a user, I want a summary view at the top of the investments tab showing total portfolio value, total P&L, and allocation breakdown.

**Acceptance Criteria:**
- [ ] Summary cards: "Valore Totale Portafoglio", "P&L Non Realizzato", "P&L Realizzato", "Cash Disponibile"
- [ ] P&L cards color-coded: green for profit, red for loss, with percentage
- [ ] Optional: simple donut chart showing allocation by asset type (stocks vs crypto vs ETF vs cash)
- [ ] Values update when prices refresh
- [ ] Responsive layout: 2-col mobile, 4-col desktop
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-025: Savings transfer history
**Description:** As a user, I want to see the history of all transfers between my savings accounts.

**Acceptance Criteria:**
- [ ] "Cronologia" button/section on savings tab
- [ ] Displays list of savings_transfers sorted by created_at DESC
- [ ] Each entry shows: date (Italian format), from account name (or "Non destinati"), to account name (or "Non destinati"), amount, note
- [ ] Color coding: green for deposits (from Non destinati), red for withdrawals (to Non destinati), neutral for account-to-account
- [ ] Pagination or infinite scroll (load 20 at a time)
- [ ] Empty state: "Nessun movimento"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-026: Investment transaction history per account
**Description:** As a user, I want to see the full buy/sell history for each investment account.

**Acceptance Criteria:**
- [ ] Each investment account card has "Storico" expandable section or button
- [ ] Lists all investment_transactions for that account sorted by transaction_date DESC
- [ ] Each entry shows: date, type badge (Acquisto green / Vendita red), asset symbol + name, quantity, price per unit, total amount, realized P&L (for sells only)
- [ ] Pagination or load more (20 at a time)
- [ ] Empty state: "Nessuna operazione"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: The system must maintain an "unallocated" balance for both savings and investments, derived from the monthly tracker data
- FR-2: Users must be able to create, rename, and delete savings accounts with unique names
- FR-3: Users must be able to manually allocate money from "Non destinati" to any savings account
- FR-4: Users must be able to transfer money between savings accounts and back to "Non destinati"
- FR-5: Users must be able to set percentage-based auto-allocation rules for savings accounts (sum <= 100%)
- FR-6: Auto-allocation rules must execute when new monthly funds are available, distributing according to percentages
- FR-7: Negative months must proportionally reduce all savings account balances (deduction = deficit * account_balance / total_savings)
- FR-8: Users must be able to create, rename, and delete investment accounts
- FR-9: Users must be able to move money from "Non destinati Investimenti" to investment account cash balance
- FR-10: Users must be able to search for stocks, ETFs, bonds, commodities via Yahoo Finance
- FR-11: Users must be able to search for cryptocurrencies via CoinGecko
- FR-12: Users must be able to record buy transactions (quantity, price, date) within an investment account, deducting from cash balance
- FR-13: Users must be able to record sell transactions, choosing where proceeds go (cash, unallocated investments, or savings unallocated)
- FR-14: The system must fetch live prices on page load and auto-refresh every 5 minutes
- FR-15: The system must calculate and display: average buy price, unrealized P&L, realized P&L per holding and per account
- FR-16: All financial amounts must be rounded to 2 decimal places; quantities support 8 decimal places (crypto)
- FR-17: Selling investment proceeds can be moved to: investment account cash, "Non destinati Investimenti", or "Non destinati Risparmi"
- FR-18: All database operations must include user_id filtering (RLS)

## Non-Goals (Out of Scope)

- No automatic bank/broker account syncing (Plaid, Open Banking)
- No tax reporting or capital gains tax calculations
- No FIFO/LIFO cost basis methods (weighted average only for v1)
- No real-time WebSocket price streaming (polling every 5 min is sufficient)
- No currency conversion between EUR/USD for asset prices (display in asset's native currency)
- No portfolio rebalancing suggestions
- No dividend tracking as separate events (dividends are already handled as income transactions in monthly tracker)
- No alerts or notifications for price changes
- No import/export of transaction history (CSV, etc.)
- No multi-currency savings accounts (EUR only for v1)

## Design Considerations

- Maintain warm Revolut-style theme consistent with the rest of the app
- Use existing Tailwind custom tokens (warmBg, warmText, warmData, warmAccent)
- Savings section: blue theme (warmData-savings)
- Investments section: purple theme (warmData-investment)
- "Non destinati" cards: prominent placement at top, slightly muted background
- Asset search modal: full-screen on mobile, centered modal on desktop
- Holdings table: compact row layout with sparkline-like P&L indicators
- Reuse existing components where possible: CountUp for animated numbers, toast for notifications
- Tab switching between Risparmi/Investimenti: no page reload, client-side state
- Responsive: mobile-first for cards, table view for holdings on desktop

## Technical Considerations

- **API Routes**: Next.js API routes in `src/app/api/assets/` for Yahoo Finance and CoinGecko calls (server-side to protect API keys and avoid CORS)
- **Yahoo Finance**: Use `yahoo-finance2` npm package (well-maintained, no API key needed for basic quotes) or direct Yahoo Finance v8 API
- **CoinGecko**: Free API tier (https://api.coingecko.com/api/v3/) - 10-30 calls/min, no key required for basic usage. Store CoinGecko Pro API key in env if rate limits become an issue
- **Price Cache**: `asset_prices_cache` table avoids redundant API calls. Prices older than 5 minutes are refreshed
- **Decimal Precision**: Use NUMERIC(18,8) for crypto quantities/prices, NUMERIC(12,2) for EUR amounts
- **Existing Integration Points**:
  - `src/lib/calculations.ts` - calculateMonthlySummary() provides monthly savings/investments amounts
  - `src/lib/wealth.ts` - calculateWealthForMonth() tracks cumulative wealth
  - `src/types/database.ts` - add new TypeScript interfaces
  - Monthly dashboard header - add link to patrimonio page
- **State Management**: All on page-level with useState/useEffect (consistent with existing app patterns, no Redux)
- **Atomicity**: Account balance updates and transfer inserts should happen in the same Supabase call where possible (use RPC functions if needed for multi-table atomicity)

## Success Metrics

- User can create savings accounts and allocate funds in under 3 clicks
- Auto-allocation rules correctly distribute funds each month without user intervention
- Asset search returns results in under 2 seconds
- Portfolio values update within 5 minutes of market price changes
- Realized/unrealized P&L matches manual calculations to the cent
- Negative month deductions are proportionally correct across all accounts
- Page loads in under 3 seconds even with 50+ holdings

## Open Questions

1. Should we support multiple currencies for investment accounts in the future? (For v1: display prices in asset's native currency, all balances in EUR)
2. Should auto-allocation rules trigger automatically on monthly tracker save, or only when user visits patrimonio page?
3. For the price cache: should stale prices (>24h) show a warning indicator?
4. Should there be a confirmation step before auto-allocation applies, or should it be fully automatic?
5. How to handle stock splits or corporate actions that change quantity?
