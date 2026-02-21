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
    layout.tsx                          # Root layout + AuthProvider + AppLayout + Toaster
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
    layout/
      AppLayout.tsx                     # Responsive shell (mobile navbar + bottom padding)
      MobileNavBar.tsx                  # Fixed bottom nav bar (4 tabs, mobile only)
    TransactionCard.tsx                 # Transaction display card (with selection mode)
    TransactionGroup.tsx                # Reusable transaction group (colorScheme + variant styling)
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
      MilestoneTable.tsx                # Milestone grid (salary, investments, dynamic expense rows)
      DebtCard.tsx                      # Debt display card
      InlineDebtForm.tsx                # Inline debt form
      DebtsList.tsx                     # Debts container
      SimulatorChart.tsx                # Multi-layer simulation chart (Recharts ComposedChart)
      ResultsSummary.tsx                # Simulation results cards
      MilestonesCards.tsx               # Wealth milestone tracking + warnings
      ExportButton.tsx                  # Export (TXT/CSV/JSON/clipboard)
  hooks/
    useInvestmentAccounts.ts            # Investment accounts business logic (atomic ops, rollback)
    useSavingsAccounts.ts               # Savings accounts business logic (atomic ops, rollback)
  contexts/
    AuthContext.tsx                      # Auth state (signUp, signIn, signOut)
  lib/
    supabase.ts                         # Supabase client config
    calculations.ts                     # Financial calculations (net, savings, investments)
    recurring.ts                        # Recurring transactions (manual copy from previous month)
    wealth.ts                           # Wealth tracking (batch queries, no recursion, computeMonthDelta)
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
Animation:    animate-cardEnter | animate-sheetSlideUp (bottom-sheet mobile modals)
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
- **Income/Expense direction in wealth**: `expense` on Investimenti/Risparmi = soldi che ENTRANO nel pool (+), `income` = soldi che ESCONO dal pool (-). Usare `sign = type === 'expense' ? 1 : -1`. Mai trattare income e expense allo stesso modo
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
- Milestone-based: year 1/5/10/20/30/50 with linear interpolation
- `MilestoneData` contains `salary` + `investment` (monthly amounts per milestone)
- Dynamic expense rows per milestone (array of ExpenseRow)
- **Investment allocation**: per-milestone fixed amounts (NOT global percentage). Savings = surplus - investment (residual)
- Investment capped at available cash flow: `toInvestments = Math.min(milestone.investment, availableCashFlow)`
- French amortization for mortgages
- Asset withdrawal priority: Savings -> Investments
- Inflation: `realValue = nominalValue / (1 + inflationRate)^years`
- Supports N parallel debts, sale events with surplus distribution (sale surplus allocation is separate, per-debt)
- **Nullish coalescing per defaults**: usare `??` mai `||` per valori numerici opzionali (es. `config.investmentReturnRate ?? 7`). `||` tratta `0` come falsy, rendendo impossibile impostare 0%
- **Shared monthly loop**: `simulateMonth()` è la funzione privata condivisa tra `simulateLegacy` e `simulateMilestone`. Il pattern callback `allocateSurplus` differenzia l'allocazione (percentuale vs importo fisso). Non duplicare il loop mensile
- **Error messages con stato pre-mutazione**: quando si azzera una variabile prima di un check, salvare il valore originale PRIMA della mutazione per usarlo nei messaggi di errore (es. `fromSavings` in `withdrawFromAssets`)
- **ID generation**: `generateId()` usa un contatore incrementale `idCounter` + timestamp + random per evitare collisioni in loop stretti. Mai usare solo `Date.now()` + `Math.random()`

### Component Architecture
- **God Components**: quando un componente supera ~500 righe di logica (30+ useState, handler complessi), estrarre un custom hook `use<ComponentName>` in `src/hooks/`. Il componente diventa puro JSX che destructura il hook
- **Hook = business logic**: il hook contiene useState, useEffect, useCallback, handler, computed values. Il componente contiene solo JSX, costanti UI (colori, label maps), e binding degli eventi
- **Costanti UI come module-level**: `TYPE_BADGE_STYLES`, `CARD_COLORS`, `ICONS` ecc. vanno fuori dal componente (module scope), non dentro il render
- **Single-pass memoized categorization**: quando il render filtra lo stesso array N volte per criteri diversi (type, is_recurring, category), sostituire con un singolo `useMemo` che fa un `for` loop e smista in un oggetto `{ group1: [], group2: [] }` calcolando i totali nello stesso passaggio. Riduce N iterazioni a 1 e previene ricalcoli ad ogni render. Esempio: dashboard page 8 filter + 5 reduce → 1 for loop
- **Propagazione loading state via callback prop**: quando un componente figlio usa un hook con stato di loading e il parent ha bisogno di quel valore per un componente fratello, aggiungere una prop callback (`onPricesLoadingChange`) + `useEffect` nel figlio che la invoca al cambio di stato. Verificato: typecheck pulito dopo aggiunta prop + useEffect (es. `InvestmentAccountsList` → `patrimonio/page.tsx` → `NetWorthCard`)
- **Wiring cross-hook via componente intermedio**: quando due hook indipendenti devono interagire (es. PAC rules + investment accounts), il componente che li istanzia entrambi crea la callback di collegamento e la passa come prop/parametro a uno dei due. Non far dipendere un hook dall'altro direttamente (es. `InvestmentAccountsList` crea `handlePacExecution` che collega `usePacRules` → `useInvestmentAccounts.pacExecutor`)

### Atomic Financial Operations (Supabase)
- **Problema**: Supabase client-side non supporta transazioni DB. Operazioni a 2+ step (es. decrementa sorgente -> incrementa destinazione) possono fallire a metà, perdendo denaro
- **Pattern rollback**: salvare il valore originale PRIMA di ogni step. Se lo step N+1 fallisce, revertire lo step N con un update esplicito al valore originale
- **Struttura**: `originalValue = current` -> step1 -> if step2 fails -> rollback step1 to `originalValue` -> toast.error con messaggio chiaro
- **Errore critico**: se anche il rollback fallisce, mostrare `toast.error('ERRORE CRITICO: ... Contatta il supporto.')` — l'utente deve sapere che lo stato è inconsistente
- **Rollback helpers**: usare funzioni dedicate (`rollbackCashBalance`, `rollbackUnallocatedInvestments`) per DRY
- **Mai ignorare errori step 2**: nel codice originale, `handleSell` faceva `await supabase...update()` senza controllare l'errore del routing dei proventi. Ogni update che modifica un bilancio DEVE avere error handling
- **Tracked rollback per operazioni N-arie**: quando si aggiornano N conti in un loop (es. auto-allocazione, deduzione mese negativo), mantenere un array `appliedChanges` con `{ accountId, originalBalance }`. Se lo step K fallisce, rollback tutti i K-1 precedenti con `rollbackAppliedBalances(appliedChanges)`. Usato in `executeAutoAllocation` e `applyNegativeMonthDeduction`
- **Logica condivisa tra UI e lib**: operazioni finanziarie come l'auto-allocazione devono vivere in una funzione lib (`executeAutoAllocation`) e essere chiamate sia da componenti UI che da funzioni automatiche — mai duplicare la logica di write DB

### Mobile & Responsive
- **Shell layout per navigazione condizionale**: usare un componente shell (`AppLayout`) che legge la route corrente e mostra/nasconde elementi di navigazione (es. bottom navbar), invece di inserire navigazione ad-hoc in ogni pagina. Escludere le route non autenticate dalla nav globale
- **Route matching per tab attivi**: `pathname.startsWith(href)` non basta quando route sibling condividono un prefisso (es. `/dashboard/patrimonio` matcha `/dashboard`). Combinare exact match + regex per distinguere sub-route dalla sezione genitore
- **Safe area inset su elementi fixed bottom**: qualsiasi `fixed bottom-0` su mobile deve includere uno spacer `h-[env(safe-area-inset-bottom)]` per dispositivi con notch
- **Bottom padding per fixed bars**: quando si aggiunge un elemento `fixed bottom-0`, il contenuto necessita di padding-bottom pari all'altezza dell'elemento. Usare classi responsive (`pb-20 md:pb-0`) per non impattare breakpoint dove la barra non e' visibile
- **Breakpoint mobile/desktop**: `md:hidden` per componenti solo mobile, il desktop resta invariato. Il breakpoint `md` (768px) e' il boundary
- **Toaster responsive (react-hot-toast)**: la prop `position` e' runtime, non CSS. In un server component serve un wrapper client component con `window.matchMedia` per switchare posizione (es. `top-center` mobile, `top-right` desktop). Pattern: `ResponsiveToaster` con `addEventListener('change', handler)` su MediaQueryList
- **Modal fullscreen mobile pattern**: `items-end` sul backdrop + `w-full h-full` + `animate-sheetSlideUp` sul content = bottom-sheet mobile. Desktop (sm+): reset con `sm:items-center sm:justify-center sm:p-4` e `sm:h-auto sm:max-w-md sm:rounded-2xl sm:animate-none`. Puro Tailwind responsive, zero JS condizionale
- **Dropdown → bottom sheet con Tailwind**: `fixed inset-x-0 bottom-0` su mobile + `sm:absolute sm:inset-auto sm:right-0` su desktop trasforma un dropdown in bottom sheet senza duplicare il componente. Chiave: `sm:inset-auto` resetta gli inset mobile prima di riapplicare il posizionamento desktop

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
6. **Milestone field wipe on update**: `handleSalaryChange` replaced entire `MilestoneData` with `{ salary: value }`, wiping other fields (e.g. `investment`). Fixed by spreading existing object: `{ ...milestones[key], salary: value }`
7. **Saved simulation backward compat**: Adding new fields to `MilestoneData` breaks old saved configs stored as JSON in DB. Fixed with `?? 0` fallback in engine + migration on load (`handleLoadSimulation` fills missing fields with defaults)
8. **Wealth income/expense bug**: Both income and expense on Investimenti/Risparmi did `+= amount`, so withdrawals INCREASED balance. Fixed with `sign = type === 'expense' ? 1 : -1` in `computeMonthDelta()`
9. **Wealth recursion (636 DB calls)**: `calculateWealthForMonth` recursed backward to year 2000 making ~636 DB queries. Fixed: now delegates to `calculateWealthForYears([year])` which uses exactly 3 batch queries
10. **Wealth DRY violation**: `computeMonthDelta` was duplicated 3x, `calculateWealthForYear` duplicated `calculateWealthForYears`. Fixed: single `computeMonthDelta` at module level, `calculateWealthForMonth` and `calculateWealthForYear` are thin wrappers around `calculateWealthForYears`
11. **Simulator `0 || default`**: `config.investmentReturnRate || 7` treated 0% as falsy → silently became 7%. Fixed with `?? 7` (nullish coalescing)
12. **Simulator monthly loop duplication**: `simulateLegacy` and `simulateMilestone` had ~90 lines of identical monthly logic. Fixed by extracting `simulateMonth()` with callback pattern for surplus allocation
13. **withdrawFromAssets wrong error amount**: `savings` was zeroed to 0 before the insufficiency check, so error showed `0 + investments` instead of actual available. Fixed by using `fromSavings` (captured pre-mutation)
14. **generateId collisions**: `Date.now()` + `Math.random()` could collide in tight loops. Fixed with incremental `idCounter`
15. **Non-atomic financial operations**: `handleTransfer`, `handleBuy`, `handleSell`, `handleDeposit` facevano step1 (decrementa) -> step2 (incrementa) senza rollback. Se step2 falliva, i soldi scomparivano. `handleSell` addirittura non controllava l'errore sul routing dei proventi. Fixed: ogni operazione ora salva il valore originale prima dello step1, e se step2 fallisce esegue rollback esplicito + toast.error. Estratto in `useInvestmentAccounts` hook con helper `rollbackCashBalance`/`rollbackUnallocatedInvestments`
16. **Non-atomic savings operations**: `SavingsAccountsList.handleDeposit` e `handleTransfer` avevano lo stesso problema del punto 15 — step1 senza rollback se step2 fallisce. Fixed: estratto `useSavingsAccounts` hook con `rollbackAccountBalance`/`rollbackSavingsUnallocated`. Utility `parseEuropeanDecimal`/`formatCurrency` riusate da `useInvestmentAccounts` (eliminata duplicazione)
17. **Auto-allocation duplicata e non-atomica**: `SavingsAutoRulesPanel.handleApplyNow` reimplementava tutta la logica di distribuzione di `applyAutoAllocationRules` (read balance -> update balance -> create transfer -> update unallocated) senza rollback. Errori durante l'update del conto N+1 lasciavano i conti 1..N già aggiornati. Fixed: estratta `executeAutoAllocation()` in `wealth-accounts.ts` con tracked rollback (`appliedChanges` array). Sia `applyAutoAllocationRules` che il pannello ora chiamano questa funzione condivisa
18. **applyNegativeMonthDeduction senza rollback**: aggiornava N conti in sequenza e poi l'unallocated, senza nessun rollback in caso di errore. Se il conto K falliva, i conti 1..K-1 erano già decrementati. Fixed: aggiunto tracked rollback identico a `executeAutoAllocation`

## Commands

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm test             # Run tests
npm run typecheck    # TypeScript check
npm run check        # Typecheck + tests
```

## Post-Task Protocol

Dopo aver completato ogni task significativo (bug fix, nuova feature, refactoring), DEVI aggiornare questo file CLAUDE.md:

1. **Bugs Fixed (Lessons Learned)**: aggiungi una nuova entry numerata con il bug, la causa root e la fix applicata
2. **Key Patterns & Best Practices**: se hai scoperto un nuovo pattern o convenzione durante l'implementazione, aggiungilo nella sezione appropriata
3. **Project Structure**: se hai creato nuovi file o directory, aggiorna l'albero
4. **Database Schema**: se hai aggiunto/modificato tabelle o constraint, documenta qui

Prerequisito OBBLIGATORIO - scrivi una lezione SOLO se:
- I **test passano** (`npm test`) dopo la fix/implementazione
- Il **typecheck passa** (`npm run typecheck`) senza errori
- Hai **verificato manualmente** o tramite test che il comportamento e' quello atteso
- La lezione descrive qualcosa che HAI EFFETTIVAMENTE SPERIMENTATO e risolto, non teoria

NON scrivere lezioni:
- Basate su intuizione o "buone pratiche generiche" non verificate nel codice
- Se i test non passano o il build e' rotto — prima fixa, poi documenta
- Se non hai evidenza concreta che il pattern funziona (test green, build ok, bug riprodotto e risolto)

Formato lezione: COSA e' andato storto + PERCHE' + come e' stato VERIFICATO che la fix funziona

Processo:
1. Dopo aver completato il task e verificato (test + typecheck green), PROPONI le lezioni all'utente in chat
2. **Chiedi conferma esplicita** all'utente prima di scrivere qualsiasi cosa nel CLAUDE.md
3. Solo dopo l'approvazione, scrivi le lezioni approvate nel file

Regole aggiuntive:
- Se la lezione e' universale (non specifica di questo progetto), aggiungila ANCHE al file globale `~/.claude/CLAUDE.md`
- Non aggiungere lezioni banali o ovvie, solo insight che hanno richiesto debug o che prevengono errori futuri
- **Genericita'**: le lezioni devono essere scritte in modo generico e riusabile. Mai usare nomi di componenti/funzioni/variabili specifiche come definizione della regola — gli esempi concreti del progetto vanno tra parentesi come illustrazione

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
