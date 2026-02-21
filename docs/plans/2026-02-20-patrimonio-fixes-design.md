# Design: Patrimonio Fixes

Date: 2026-02-20

## Issues

### 1. Cambio conto principale (feature)

**Problema:** Il campo `is_primary` esiste nel DB e nel tipo `SavingsAccount`, ma non c'è UI per cambiarlo. Solo un badge "Principale" in sola lettura.

**Soluzione:** Aggiungere un bottone "Rendi principale" sulle card dei conti non-primari (accanto al badge/nome). Operazione 2-step con rollback:

1. `UPDATE savings_accounts SET is_primary = false WHERE is_primary = true AND user_id = ?`
2. `UPDATE savings_accounts SET is_primary = true WHERE id = ? AND user_id = ?`

Rollback: se step 2 fallisce, re-eseguire step 1 con il valore originale. Se rollback fallisce → toast errore critico.

**File coinvolti:**
- `src/hooks/useSavingsAccounts.ts` → aggiungere `handleSetPrimary(accountId: string)`
- `src/components/SavingsAccountsList.tsx` → aggiungere bottone "Rendi principale" sulla card, visibile solo se `!account.is_primary`

### 2. Investimenti sempre caricati (bug fix)

**Problema:** `InvestmentAccountsList` è renderizzato condizionalmente solo quando `activeTab === 'investimenti'`. I callback `onTotalMarketValue`, `onDistributionData`, `onPricesLoadingChange` non vengono mai chiamati finché l'utente non clicca il tab. Risultato: `NetWorthCard` e grafico distribuzione mostrano investimenti = 0 all'apertura della pagina.

**Soluzione:** Rendere `InvestmentAccountsList` sempre montato, nascondendolo con `className="hidden"` quando il tab è `risparmi`. I hook del componente si eseguono al mount della pagina → i callback vengono chiamati immediatamente.

**File coinvolti:**
- `src/app/dashboard/patrimonio/page.tsx` → cambiare il render condizionale da `{activeTab === 'investimenti' ? <InvestmentAccountsList> : <SavingsAccountsList>}` a entrambi montati, con `className={activeTab === 'investimenti' ? '' : 'hidden'}` su `InvestmentAccountsList` e viceversa.

## Acceptance Criteria

- [ ] Su ogni conto non-principale appare un bottone "Rendi principale"
- [ ] Cliccando il bottone, il conto diventa principale (badge "Principale" si sposta)
- [ ] L'operazione è atomica con rollback se uno step fallisce
- [ ] Aprendo la sezione patrimonio sul tab risparmi, NetWorthCard mostra il valore corretto degli investimenti (non 0)
- [ ] Il grafico distribuzione è corretto già al primo caricamento
- [ ] Il tab visivo resta invariato (una sola lista visibile alla volta)
