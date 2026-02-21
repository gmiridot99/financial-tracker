# Refactoring: src/lib/wealth.ts

## Stato: COMPLETATO

---

## STEP 1: Safety Net (FATTO)

3 test che dimostravano i bug. Tutti e 3 FALLIVANO prima del fix.

| # | Bug | Prima | Dopo |
|---|-----|-------|------|
| 1 | Income Investimenti sommava invece di sottrarre | 12000 (sbagliato) | 8000 (corretto) |
| 2 | Income Risparmi sommava invece di sottrarre | 9500 (sbagliato) | 6500 (corretto) |
| 3 | Ricorsione: 636 query DB senza snapshot | 636 calls | 3 calls |

---

## STEP 2: Refactoring (FATTO)

### 2.1 Fix income/expense — COMPLETATO
- Estratto `computeMonthDelta()` a livello di modulo (riga 28-45)
- Logica: `sign = type === 'expense' ? 1 : -1`
- expense Investimenti/Risparmi → somma al pool
- income Investimenti/Risparmi → sottrae dal pool

### 2.2 Eliminare ricorsione — COMPLETATO
- `calculateWealthForMonth` ora delega a `calculateWealthForYears([year])` (riga 60-71)
- Da ~636 query DB ricorsive a esattamente 3 query batch
- Nessun rischio di stack overflow

### 2.3 DRY: computeMonthDelta — COMPLETATO
- Da 3 copie (inline in 3 funzioni diverse) a 1 funzione condivisa
- Usata da `calculateWealthForYears` che e il motore unico

### 2.4 DRY: Unificare ForYear/ForYears — COMPLETATO
- `calculateWealthForYear` → wrapper 3 righe su `calculateWealthForYears`
- `calculateWealthForMonth` → wrapper 5 righe su `calculateWealthForYears`
- Tutta la logica batch vive in UN solo posto

### 2.5 Type Safety — COMPLETATO
- Rimossi tutti i `(t as any).categories?.name`
- Aggiunto `TransactionWithCategory` type (riga 7-12)
- Aggiunto `NormalizedTransaction` type (riga 15-19)
- Cast via `as unknown as TransactionWithCategory[]` (ponte tipizzato, non any)

---

## Risultato finale

| Metrica | Prima | Dopo |
|---------|-------|------|
| Righe wealth.ts | 612 | 355 |
| Funzioni duplicate | 3x computeMonthDelta | 1x condivisa |
| Funzioni duplicate (anno) | calculateWealthForYear (180 righe) | wrapper 3 righe |
| Query DB per mese singolo | ~636 (ricorsione) | 3 (batch) |
| `as any` | 3 | 0 |
| Bug income/expense | income += amount (sbagliato) | income -= amount (corretto) |
| Test | 15 pass + 3 fail (bug) | 18/18 pass |

## File modificati
- `src/lib/wealth.ts` — riscritto
- `src/lib/wealth.test.ts` — aggiornato mock + test
- `CLAUDE.md` — aggiunti bug #8, #9, #10 + regola income/expense
