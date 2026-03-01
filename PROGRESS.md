# Progress — 5 fix richiesti

## Stato
- [x] 1. Fix colore sezione spese (rosso)
- [x] 2. Cambio conto in modifica transazione (atomico)
- [x] 3. Rimozione "non destinati"
- [x] 4. Redesign UI investimenti (holdings sempre visibili)
- [x] 5. Fix storico prezzi + campo "Prezzo"

---

## Dettagli

### 1. Fix colore `InlineTransactionForm.tsx`
`border-warmAccent-primary` → `border-warmData-expense`, `bg-warmData-expense/5`

### 2. `TransactionModal.tsx`
Chip selector account visibile in edit mode, operazione atomica con rollback completo

### 3. Rimozione non-destinati
- `useSavingsAccounts.ts`: rimuovere `savingsUnallocated`, `handleDeposit`, rollback helper
- `SavingsAccountsList.tsx`: rimuovere prop, bottone Deposita, opzione "Non destinati"
- `useInvestmentAccounts.ts`: `handleDeposit` → deposito diretto su cash_balance, rimuovere opzioni non-destinati
- `InvestmentAccountsList.tsx`: rimuovere prop, riga "Disponibili", opzioni non-destinati
- `patrimonio/page.tsx`: rimuovere props

### 4. UI investimenti
Rimuovere expandedAccounts, holdings sempre visibili con dati compatti su 2 righe

### 5. `/api/assets/history/route.ts`
Usare JWT utente (anon key) invece di service role key
