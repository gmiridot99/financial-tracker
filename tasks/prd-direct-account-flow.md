# PRD: Flusso Diretto Dashboard - Conti Patrimonio

## Introduction

L'attuale architettura usa "Non Destinati" come buffer intermedio tra la dashboard mensile e i conti patrimonio. Il flusso e': transazione generica → calcolo percentuale savings/investments → Non Destinati → deposito manuale nei conti. Nella vita reale dell'utente il flusso e' diretto: bonifico automatico al conto investimento → PAC auto-investe. Il concetto di "Non Destinati" non riflette il flusso reale e aggiunge complessita'.

Questa feature sostituisce l'intero sistema intermedio con un collegamento diretto: ogni transazione di investimento o risparmio dalla dashboard va a un conto specifico in patrimonio. L'avanzo mensile (non speso, non allocato) viene depositato automaticamente in un conto risparmi primario.

## Goals

- Eliminare il concetto di "Non Destinati" (sia investimenti che risparmi)
- Eliminare le auto-allocation rules per i risparmi
- Collegare direttamente ogni transazione investimento/risparmio a un conto patrimonio
- Permettere il collegamento opzionale delle transazioni ricorrenti ai PAC esistenti
- Introdurre un conto risparmi "primario" che raccoglie l'avanzo mensile
- Mantenere la possibilita' di editing manuale dei saldi nei conti
- Semplificare il calcolo dei wealth snapshots (derivati dai saldi conti)

## User Stories

### US-001: Migration DB - Destinazione su transazioni
**Description:** Come sistema, devo poter collegare le transazioni a conti specifici in patrimonio, per tracciare dove vanno i soldi.

**Acceptance Criteria:**
- [ ] Nuova colonna `investment_account_id` (UUID, nullable, FK → investment_accounts) sulla tabella `transactions`
- [ ] Nuova colonna `savings_account_id` (UUID, nullable, FK → savings_accounts) sulla tabella `transactions`
- [ ] Nuova colonna `trigger_pac` (boolean, default false) sulla tabella `transactions`
- [ ] Constraint: `investment_account_id` e `savings_account_id` non possono essere entrambi NOT NULL
- [ ] Nuova colonna `is_primary` (boolean, default false) sulla tabella `savings_accounts`
- [ ] Constraint: al massimo un savings_account per user con `is_primary = true`
- [ ] Migration file creato in `supabase/migrations/`
- [ ] Types in `src/types/database.ts` aggiornati
- [ ] Typecheck passa

### US-002: Conto primario risparmi
**Description:** Come utente, voglio avere un conto risparmi "primario" (Conto Corrente) che rappresenta la mia liquidita' non allocata, in modo che l'avanzo mensile venga tracciato.

**Acceptance Criteria:**
- [ ] Nel patrimonio, sezione risparmi, il conto primario e' sempre visibile in cima alla lista
- [ ] Il conto primario e' visivamente distinto dagli altri (icona banca, badge "Principale")
- [ ] L'utente puo' rinominarlo
- [ ] L'utente NON puo' eliminarlo (solo cambiare quale conto e' primario)
- [ ] Se non esiste un conto primario, l'app ne crea uno automaticamente ("Conto Corrente") al primo accesso alla pagina patrimonio
- [ ] Il saldo del conto primario e' editabile manualmente (matita → inline edit)
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-003: Investimento con destinazione conto
**Description:** Come utente, quando registro un investimento dalla dashboard mensile, voglio scegliere in quale conto investimento vanno i soldi, in modo che il deposito avvenga direttamente.

**Acceptance Criteria:**
- [ ] `InvestmentForm.tsx`: nuovo dropdown "Conto destinazione" che lista i conti investimento dell'utente
- [ ] Il dropdown e' obbligatorio — non si puo' salvare senza scegliere un conto
- [ ] Se non ci sono conti: il dropdown mostra "Nessun conto — Crea in Patrimonio →" con link a `/dashboard/patrimonio`
- [ ] Al submit: la transazione viene inserita con `investment_account_id` impostato
- [ ] Al submit: il `cash_balance` del conto destinazione viene incrementato dell'importo (con rollback pattern se l'update fallisce)
- [ ] Il `TransactionModal.tsx` mostra il dropdown destinazione quando la categoria selezionata e' "Investimenti"
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-004: Collegamento PAC su investimenti ricorrenti
**Description:** Come utente, quando registro un investimento ricorrente, voglio opzionalmente collegarlo a un PAC del conto destinazione, in modo che al deposito i soldi vengano auto-investiti negli asset configurati.

**Acceptance Criteria:**
- [ ] Se la transazione e' ricorrente E un conto e' selezionato: mostrare opzione "Collega PAC"
- [ ] Se il conto ha PAC rules attive: mostrare checkbox "Attiva PAC automatico"
- [ ] Se checkbox attiva: transazione salvata con `trigger_pac = true`
- [ ] Se `trigger_pac = true`: dopo il deposito cash, eseguire `executePacRules()` (da `src/lib/pac-execution.ts`) per il conto
- [ ] Se il conto NON ha PAC rules: non mostrare l'opzione PAC
- [ ] Se `trigger_pac = false` o non ricorrente: solo deposito cash, nessun auto-buy
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-005: Risparmio con destinazione conto
**Description:** Come utente, quando registro un risparmio dalla dashboard mensile, voglio scegliere in quale conto risparmio vanno i soldi (escludendo il conto primario che riceve l'avanzo).

**Acceptance Criteria:**
- [ ] Nuovo componente `InlineSavingsForm.tsx` nella dashboard (stile blue/savings, simile a InvestmentForm)
- [ ] Dropdown "Conto destinazione" che lista i conti risparmio dell'utente (escluso il primario)
- [ ] Il dropdown e' obbligatorio
- [ ] Se non ci sono conti (oltre al primario): mostrare "Nessun conto — Crea in Patrimonio →"
- [ ] Al submit: transazione inserita come expense con categoria "Risparmi" e `savings_account_id` impostato
- [ ] Al submit: il `balance` del conto destinazione viene incrementato (con rollback pattern)
- [ ] Il `TransactionModal.tsx` mostra il dropdown destinazione quando la categoria selezionata e' "Risparmi"
- [ ] Il form compare nella dashboard mensile tra InvestmentForm e il contenuto esistente
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-006: Calcolo e deposito avanzo mensile
**Description:** Come utente, voglio che l'avanzo mensile (income - expenses - investimenti - risparmi espliciti) venga depositato nel mio conto primario, in modo da tracciare la mia liquidita'.

**Acceptance Criteria:**
- [ ] Calcolo avanzo: `income - expenses - investimenti_espliciti - risparmi_espliciti` (dove espliciti = transazioni con `investment_account_id` o `savings_account_id` impostato)
- [ ] L'avanzo e' mostrato nella dashboard mensile come riga nel riepilogo ("Avanzo: +400 EUR")
- [ ] Alla chiusura del mese (quando l'utente naviga al mese successivo O tramite azione manuale), l'avanzo viene depositato nel conto primario
- [ ] Se l'avanzo e' negativo: il conto primario viene decrementato (l'utente ha speso piu' di quanto guadagnato)
- [ ] Il deposito crea un record tracciabile (transaction con `savings_account_id = primary_account_id`)
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-007: Rimozione Non Destinati e Auto-Rules dalla UI
**Description:** Come utente, la sezione patrimonio non mostra piu' "Non Destinati" e le auto-allocation rules, perche' i flussi ora sono diretti.

**Acceptance Criteria:**
- [ ] Pagina patrimonio: rimosse le card "Non Destinati Investimenti" e "Non Destinati Risparmi"
- [ ] Pagina patrimonio: rimosso il pannello `SavingsAutoRulesPanel`
- [ ] Rimosse le chiamate a `recalculateUnallocated()`, `applyAutoAllocationRules()`, `setManualUnallocated()`
- [ ] Lo stato `unallocated` e gli handler di editing rimossi dalla pagina
- [ ] L'import di `recalculateUnallocated`, `applyAutoAllocationRules`, `setManualUnallocated` rimosso
- [ ] La pagina carica direttamente i conti e i totali senza passare per il ricalcolo unallocated
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-008: Editing manuale saldi risparmi
**Description:** Come utente, voglio poter modificare manualmente il saldo di qualsiasi conto risparmio direttamente nella sezione patrimonio, per correggere errori o allineare i dati.

**Acceptance Criteria:**
- [ ] Ogni conto risparmio mostra un'icona matita accanto al saldo
- [ ] Click sulla matita → il saldo diventa un input inline (con check/X per conferma/annulla)
- [ ] Accetta sia virgola che punto come separatore decimale
- [ ] Il salvataggio aggiorna `savings_accounts.balance` nel DB
- [ ] Toast di conferma/errore
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-009: Editing manuale asset investimenti
**Description:** Come utente, voglio poter modificare manualmente le quantita' degli asset nei miei conti investimento e il cash balance, per correggere errori.

**Acceptance Criteria:**
- [ ] Il `cash_balance` di ogni conto investimento mostra un'icona matita
- [ ] Click → inline edit, stessa UX dei risparmi (US-008)
- [ ] Per ogni holding (asset nel conto): bottone "Modifica" sulla riga dell'asset
- [ ] Click "Modifica" → permette di cambiare quantita' e/o prezzo medio di carico
- [ ] La modifica crea una transazione di aggiustamento (buy/sell) per riconciliare la differenza
- [ ] Esempio: holding = 10 VWCE, utente cambia a 12 → sistema crea buy di 2 unita' al prezzo corrente
- [ ] Toast di conferma/errore con dettaglio dell'aggiustamento
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-010: Semplificazione calcolo Wealth Snapshots
**Description:** Come sistema, i wealth snapshots devono derivare direttamente dai saldi dei conti, senza passare per i Non Destinati.

**Acceptance Criteria:**
- [ ] `investments_balance` = sum(investment_accounts.cash_balance) + sum(holdings market value)
- [ ] `savings_balance` = sum(savings_accounts.balance) (incluso conto primario)
- [ ] Rimossa la dipendenza da `unallocated_balances` nel calcolo
- [ ] `updateWealthSnapshotFromAccounts()` in `src/lib/wealth.ts` semplificato
- [ ] I test in `src/lib/wealth.test.ts` aggiornati per il nuovo calcolo
- [ ] Typecheck passa
- [ ] Tests passano

### US-011: Cleanup codice deprecato
**Description:** Come sviluppatore, devo rimuovere il codice relativo a Non Destinati e auto-allocation che non e' piu' utilizzato.

**Acceptance Criteria:**
- [ ] Eliminato `src/components/SavingsAutoRulesPanel.tsx`
- [ ] Da `src/lib/wealth-accounts.ts`: rimosse `executeAutoAllocation`, `applyAutoAllocationRules`, `setManualUnallocated`, `recalculateUnallocated`, `computeFullUnallocated`, `applyNegativeMonthDeduction`
- [ ] Da `src/lib/wealth-calculations.ts`: rimosse `computeUnallocated`, `computeAutoAllocation`, `computeNegativeMonthDeduction`, `applyOverrides`, `applyTransactionDelta`
- [ ] Da `src/lib/wealth-calculations.test.ts`: rimossi test relativi
- [ ] Da `src/types/database.ts`: rimossi `SavingsAutoRule`, `UnallocatedBalance` (o marcati deprecated)
- [ ] Nessun file importa piu' le funzioni rimosse
- [ ] Il `WealthSetupBanner` viene aggiornato o rimosso (l'onboarding cambia: "Crea il tuo primo conto")
- [ ] Typecheck passa
- [ ] Tests passano

## Functional Requirements

- FR-1: Le transazioni con categoria "Investimenti" DEVONO avere un `investment_account_id` associato
- FR-2: Le transazioni con categoria "Risparmi" DEVONO avere un `savings_account_id` associato
- FR-3: Una transazione NON puo' avere sia `investment_account_id` che `savings_account_id` (constraint DB)
- FR-4: Quando una transazione investimento viene inserita, il `cash_balance` del conto destinazione viene incrementato automaticamente
- FR-5: Se la transazione ha `trigger_pac = true`, dopo il deposito vengono eseguite le PAC rules del conto (funzione `executePacRules()` esistente)
- FR-6: Quando una transazione risparmio viene inserita, il `balance` del conto destinazione viene incrementato automaticamente
- FR-7: Ogni utente ha esattamente un conto risparmio con `is_primary = true` (creato automaticamente se non esiste)
- FR-8: L'avanzo mensile (income - expenses - investimenti - risparmi) viene depositato nel conto primario
- FR-9: Tutti gli aggiornamenti di saldo usano il rollback pattern (salva valore originale, rollback se step successivo fallisce)
- FR-10: I wealth snapshots vengono calcolati esclusivamente dai saldi dei conti (nessun riferimento a Non Destinati)
- FR-11: L'utente puo' editare manualmente il saldo di qualsiasi conto risparmio
- FR-12: L'utente puo' editare manualmente il cash_balance e le quantita' degli asset nei conti investimento
- FR-13: Le modifiche manuali agli asset creano transazioni di aggiustamento per audit trail

## Non-Goals

- Non implementiamo API esterne per i prezzi degli asset (gia' esistente, invariato)
- Non modifichiamo il sistema PAC in se' — solo il collegamento dalla dashboard
- Non aggiungiamo notifiche push o reminders per depositi
- Non implementiamo riconciliazione automatica con conti bancari reali
- Non modifichiamo il simulatore finanziario
- Non tocchiamo il recap annuale (si adattera' ai nuovi dati senza modifiche)
- Non eliminiamo le tabelle deprecate dal DB in questa release (solo rimozione del codice che le usa)

## Design Considerations

### UI/UX
- I form investimento e risparmio nella dashboard seguono il pattern esistente di `InlineIncomeForm` / `InvestmentForm`: card colored con expand/collapse
- Il form risparmi usa il colore `warmData-savings` (blue) per coerenza visiva
- Il conto primario nel patrimonio ha un badge "Principale" e un'icona banca per distinguerlo
- L'editing inline dei saldi segue il pattern gia' usato per i Non Destinati (pencil → input → check/X)
- Il dropdown conto nella dashboard e' un `<select>` standard, consistente con gli altri dropdown del form

### Componenti esistenti da riutilizzare
- `InvestmentForm.tsx` — da estendere con dropdown conto
- `InlineIncomeForm.tsx` — pattern di riferimento per `InlineSavingsForm.tsx`
- `TransactionModal.tsx` — da estendere con dropdown condizionale
- `executePacRules()` da `src/lib/pac-execution.ts` — riutilizzato per PAC su deposito diretto
- Rollback helpers da `src/hooks/useInvestmentAccounts.ts` e `src/hooks/useSavingsAccounts.ts`
- `parseEuropeanDecimal()` e `formatCurrency()` da `src/hooks/useInvestmentAccounts.ts`

## Technical Considerations

- **Rollback pattern obbligatorio**: ogni operazione di deposito (dashboard → conto) deve implementare il pattern: salva originale → step1 → step2 → rollback se step2 fallisce. Supabase client-side non supporta transazioni DB
- **RLS**: tutti i nuovi query devono includere `.eq('user_id', user.id)`
- **Backward compatibility**: le transazioni esistenti (senza `investment_account_id` / `savings_account_id`) restano valide — i nuovi campi sono nullable
- **Constraint unicita' conto primario**: usare un partial unique index `CREATE UNIQUE INDEX ON savings_accounts (user_id) WHERE is_primary = true`
- **Performance**: il calcolo avanzo mensile richiede solo le transazioni del mese corrente, non tutte le transazioni storiche

## Success Metrics

- L'utente registra un investimento dalla dashboard e il saldo del conto in patrimonio si aggiorna immediatamente
- L'utente registra un risparmio dalla dashboard e il saldo del conto in patrimonio si aggiorna immediatamente
- L'avanzo mensile viene depositato nel conto primario senza intervento manuale
- L'utente puo' correggere qualsiasi saldo manualmente dalla sezione patrimonio
- Zero occorrenze di "Non Destinati" nell'interfaccia utente
- Nessuna regressione nelle funzionalita' esistenti (PAC, buy/sell, transfer, charts)

## Open Questions

1. **Trigger del deposito avanzo**: quando esattamente viene depositato l'avanzo nel conto primario? Opzioni: (a) quando l'utente naviga al mese successivo, (b) con un bottone "Chiudi mese", (c) automaticamente a inizio mese nuovo. Da definire con l'utente.
2. **Transazioni storiche**: le transazioni gia' esistenti senza conto destinazione — vanno migrate? O accettiamo che il vecchio storico non ha il link diretto?
3. **Settings page**: la pagina settings ha lo split percentuale savings/investments. Rimuoverla? Lasciarla come riferimento? Sostituirla con qualcos'altro?
4. **Categoria "Risparmi"**: esiste gia' come categoria default o va creata? Verificare le categories seed nel DB.
