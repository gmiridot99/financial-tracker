# Transazioni ricorrenti con stato "pending"

## Checklist implementazione

- [ ] **Step 1** — Migrazione DB (`supabase/migrations/20260301000001_add_pending_status.sql`)
  - Aggiungere `status TEXT CHECK(status IN ('pending', 'active')) DEFAULT NULL` a `transactions`
  - Aggiungere `status TEXT CHECK(status IN ('pending', 'active')) DEFAULT NULL` a `transfers`
  - Index su `(user_id, start_date) WHERE status = 'pending'` per transactions
  - Index su `(user_id, date) WHERE status = 'pending'` per transfers

- [ ] **Step 2** — TypeScript types (`src/types/database.ts`)
  - `status: 'pending' | 'active' | null` su `Transaction`
  - `status: 'pending' | 'active' | null` su `Transfer`

- [ ] **Step 3** — Fix + modifica `copyRecurringFromPreviousMonth` (`src/lib/recurring.ts`)
  - Transazioni: aggiungere `status: 'pending'` + fix copia `savings_account_id`, `investment_account_id`, `trigger_pac` (bug attuale: non copiati)
  - Trasferimenti: aggiungere `status: 'pending'` + rimuovere tutto il codice di balance update immediato (source-, dest+, PAC)

- [ ] **Step 4** — Nuova funzione `activatePendingRecurring(userId)` (`src/lib/recurring.ts`)
  - Query transactions `status = 'pending' AND start_date <= oggi` per userId
  - Per ciascuna: aggiorna saldo conto collegato con rollback pattern
    - income + savings_account_id → balance += amount
    - expense + savings_account_id → balance -= amount
    - income/expense + investment_account_id → cash_balance ±= amount
    - nessun conto → solo attiva visivamente
  - Query transfers `status = 'pending' AND date <= oggi` per userId
  - Per ciascuno: esegui balance update (source-, dest+, PAC se trigger_pac) + status = 'active'
  - Return `{ transactionsActivated, transfersActivated }`

- [ ] **Step 5** — Dashboard page (`src/app/dashboard/[year]/[month]/page.tsx`)
  - `useEffect` che chiama `activatePendingRecurring` solo per il mese corrente
  - Toast "Attivate N ricorrenti" se count > 0 + reload transazioni e trasferimenti
  - Nel `useMemo` dei totali: skip transazioni con `status === 'pending'`

- [ ] **Step 6** — Visual pending (`src/components/TransactionCard.tsx`)
  - `status === 'pending'`: `opacity-60`, badge "In attesa · gg/mm", bordo grigio
  - `status === 'active'` o `null`: stile invariato

- [ ] **Step 7** — Wealth calculations (`src/lib/wealth.ts`)
  - Filtro `.or('status.is.null,status.eq.active')` in `computeMonthDelta`

## Verifica end-to-end

- [ ] Migration applicata su Supabase SQL Editor
- [ ] Import ricorrenti → appaiono con stile pending + non contano nei totali
- [ ] Ricarica dopo data raggiunta → toast + stile normale + saldo conto aggiornato
- [ ] Transazioni manuali (status = null) non impattate
- [ ] `npm run typecheck` — zero errori
- [ ] `npm test` — tutti i test verdi
