# Code Audit: Roadmap Refactoring

Report generato dall'analisi architetturale del progetto.
5 aree critiche identificate, ordinate per rischio.

---

## 1. InvestmentAccountsList.tsx — Risk 10/10 — COMPLETATO

**File**: `src/components/InvestmentAccountsList.tsx` (1627 righe -> 930 righe)
**File nuovo**: `src/hooks/useInvestmentAccounts.ts` (~520 righe)
**Problemi risolti**:
- [x] Componente monolitico: estratto custom hook `useInvestmentAccounts` con tutti gli useState, useEffect, useCallback e handler
- [x] **Operazioni finanziarie non-atomiche**: ogni operazione a 2 step (handleTransfer, handleBuy, handleSell, handleDeposit, handleEditTransaction, handleDeleteTransaction) ora ha rollback esplicito con try/catch. Se il passo 2 fallisce, il passo 1 viene revertito e l'utente vede un errore chiaro
- [x] `parseEuropeanDecimal` e `formatCurrency` estratti come export dal hook (riutilizzabili)
- [ ] CRUD condiviso con SavingsAccountsList (hook generico) — DA FARE nel task #5
- [ ] Sotto-componenti UI (AccountCard, TransactionHistory) — prossima iterazione

**Risultato**:
- Business logic completamente separata dalla UI
- InvestmentAccountsList.tsx: 1627 righe -> 930 righe (solo JSX + hook call)
- useInvestmentAccounts.ts: ~520 righe di logica pura con rollback atomico
- Typecheck OK
- Rollback implementato su 6 operazioni finanziarie critiche

---

## 2. wealth.ts — Risk 9/10 — COMPLETATO

**File**: `src/lib/wealth.ts`
**Problemi risolti**:
- [x] Bug logico: income e expense trattati identicamente (entrambi +=)
- [x] Ricorsione illimitata: 636 query DB per un singolo mese
- [x] DRY: computeMonthDelta duplicato 3x
- [x] DRY: calculateWealthForYear duplicava calculateWealthForYears (180 vs 198 righe)
- [x] Type safety: 3x `as any` rimossi, tipizzato con TransactionWithCategory

**Risultato**:
- 612 righe → 355 righe (-42%)
- 636 query → 3 query
- 18/18 test PASS
- Dettagli in `tasks/wealth-refactoring.md`

---

## 3. simulator.ts + calculations.ts — Risk 8/10 — COMPLETATO

**File**: `src/lib/simulator/simulator.ts`
**File**: `src/lib/simulator/calculations.ts`
**Problemi risolti**:
- [x] Bug `0 || default`: `|| 7` → `?? 7` per `investmentReturnRate` e `savingsReturnRate`
- [x] Duplicazione loop mensile: estratta funzione privata `simulateMonth()` con pattern callback `allocateSurplus` per differenziare legacy (percentuale) da milestone (importo fisso)
- [x] `withdrawFromAssets`: errore ora mostra `fromSavings + investments` (saldo originale) invece di `savings + investments` (savings già azzerato)
- [x] `generateId`: aggiunto contatore incrementale `idCounter` per evitare collisioni in loop stretti

**Risultato**:
- Loop mensile deduplicato: ~90 righe duplicate → 1 funzione condivisa `simulateMonth()`
- 107/107 test PASS
- Typecheck OK

---

## 4. dashboard/[year]/[month]/page.tsx — Risk 7/10 — COMPLETATO

**File**: `src/app/dashboard/[year]/[month]/page.tsx` (696 righe -> ~590 righe)
**File nuovo**: `src/components/TransactionGroup.tsx` (~110 righe)
**Problemi risolti**:
- [x] 5 blocchi JSX quasi identici (~125 righe totali) sostituiti con 5 chiamate a `<TransactionGroup />` (~50 righe totali)
- [x] 8 `.filter()` + 5 `.reduce()` (13 iterazioni) sostituiti con single-pass `useMemo` categorization (1 iterazione)
- [x] `calculateMonthlySummary` ora memoizzato insieme ai gruppi
- [x] `TransactionGroup` usa style map a module scope (`STYLE_MAP`) con `colorScheme` + `variant` (primary/secondary)

**Risultato**:
- ~100 righe di JSX duplicato eliminate
- 13 iterazioni array → 1 (single-pass for loop in useMemo)
- Typecheck OK, 107/107 test PASS
- Design visivo identico (stessi colori, opacità, bordi per ogni gruppo)

---

## 5. SavingsAccountsList + SavingsAutoRulesPanel + wealth-accounts.ts — Risk 7/10 — COMPLETATO

**File**: `src/components/SavingsAccountsList.tsx` (612 righe -> 369 righe)
**File nuovo**: `src/hooks/useSavingsAccounts.ts` (~270 righe)
**File**: `src/components/SavingsAutoRulesPanel.tsx` (346 righe -> 290 righe)
**File**: `src/lib/wealth-accounts.ts` (333 righe -> 459 righe, +rollback helpers + executeAutoAllocation)
**Problemi risolti**:
- [x] SavingsAccountsList: estratto custom hook `useSavingsAccounts` con tutti useState, useEffect, useCallback e handler
- [x] **Operazioni finanziarie non-atomiche**: `handleDeposit` e `handleTransfer` ora hanno rollback esplicito con `rollbackAccountBalance` e `rollbackSavingsUnallocated`. Se step 2 fallisce, step 1 viene revertito + toast.error chiaro
- [x] `parseEuropeanDecimal` e `formatCurrency` riusati da `useInvestmentAccounts` (eliminata duplicazione)
- [x] SavingsAutoRulesPanel.handleApplyNow: eliminata reimplementazione duplicata — ora usa `computeAutoAllocation()` + `executeAutoAllocation()` dalla lib
- [x] wealth-accounts.ts: estratta `executeAutoAllocation()` condivisa con rollback (usata sia da `applyAutoAllocationRules` che dal pannello)
- [x] wealth-accounts.ts: `applyNegativeMonthDeduction` ora ha tracked rollback — se un aggiornamento conto fallisce, tutti quelli precedenti vengono revertiti. Se l'aggiornamento unallocated fallisce, tutti i conti vengono ripristinati

**Risultato**:
- Business logic completamente separata dalla UI
- SavingsAccountsList.tsx: 612 righe -> 369 righe (solo JSX + hook call)
- useSavingsAccounts.ts: ~270 righe di logica pura con rollback atomico
- SavingsAutoRulesPanel: -56 righe di logica duplicata, ora delegata alla lib
- wealth-accounts.ts: rollback su tutte le operazioni finanziarie multi-step
- Rollback implementato su 4 punti critici (handleDeposit, handleTransfer, executeAutoAllocation, applyNegativeMonthDeduction)

---

## Riepilogo avanzamento

| # | Area | Risk | Stato |
|---|------|------|-------|
| 1 | InvestmentAccountsList.tsx | 10/10 | COMPLETATO |
| 2 | wealth.ts | 9/10 | COMPLETATO |
| 3 | simulator.ts + calculations.ts | 8/10 | COMPLETATO |
| 4 | dashboard/[year]/[month]/page.tsx | 7/10 | COMPLETATO |
| 5 | SavingsAccountsList + AutoRules + wealth-accounts | 7/10 | COMPLETATO |

**Completati: 5/5** | **Tutti i task dell'audit sono stati completati!**
