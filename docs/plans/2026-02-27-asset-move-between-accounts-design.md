# Design: Spostamento asset tra conti investimento

**Data:** 2026-02-27
**Stato:** Approvato

## Obiettivo

Permettere all'utente di spostare una quantità di un asset (holding) da un conto investimento a un altro, senza effetti sul cash balance (transfer in-kind).

## Approccio scelto: Transfer in-kind

Inserisce una coppia di transazioni sintetiche al prezzo medio di carico (avgPrice):
- `sell` nel conto sorgente
- `buy` nel conto destinazione

Nessuna modifica ai `cash_balance`. Il P&L rimane zero, il cost basis si preserva.

## Operazione logica

Per spostare `N` unità di `SYMBOL` dal conto A al conto B:

1. **Step 1** — INSERT `sell` in conto A: `quantity=N`, `price_per_unit=avgPrice`, `total_amount=N*avgPrice`, `transaction_date=oggi`
2. **Step 2** — INSERT `buy` in conto B: stessi campi ma `investment_account_id=B`
3. **Rollback**: se Step 2 fallisce → DELETE la sell di Step 1
4. Nessuna modifica ai `cash_balance`

## UI

Bottone `ArrowRightLeft` ("Trasferisci") nella riga di ogni holding, accanto a "Vendi".

Form inline al click:
```
[AAPL — 10 unità @ 150,00 €]
Trasferisci a:  [Conto B ▼]    (esclude conto corrente)
Quantità:       [____]          max: 10
                [ Annulla ]  [ Trasferisci ]
```

Validazione: `0 < quantità <= holding.quantity`
Feedback: `toast.success("Trasferiti 5 AAPL da Conto A a Conto B")`

## Stato nel hook (`useInvestmentAccounts`)

Tre nuovi campi di stato:
```ts
movingHolding: { accountId: string; holding: Holding } | null
moveQuantity: string
moveDestination: string
```

Nuovo handler: `handleMoveHolding()` — pattern atomico con rollback, coerente con `handleSell`/`handleTransfer`.

## Componente (`InvestmentAccountsList`)

- Bottone "Trasferisci" accanto a "Vendi" nella riga holding
- Form inline move (quantità + dropdown destinazione) nello stesso stile del form sell

## File da modificare

- `src/hooks/useInvestmentAccounts.ts` — stato + handler
- `src/components/InvestmentAccountsList.tsx` — UI bottone + form inline

## Nessuna migrazione DB richiesta

Le tabelle `investment_transactions` e `investment_accounts` sono già sufficienti.
