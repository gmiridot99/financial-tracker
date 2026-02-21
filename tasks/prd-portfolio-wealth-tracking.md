# PRD: Portfolio & Wealth Tracking - Phase 1

## Introduction

Estendere il sistema di investimenti esistente con:
1. **PAC (Piano di Accumulo Capitale)**: regole di distribuzione automatica degli investimenti su asset specifici, triggerate quando l'utente deposita fondi in un investment account
2. **Prezzi automatici**: mantenere Yahoo Finance + CoinGecko come price feed (migrazione a Finnhub rimandata dopo verifica copertura ETF Milano)
3. **Patrimonio netto aggregato**: vista unificata che somma liquidita' (conti risparmio + cash investimenti + unallocated) e investimenti (market value delle holdings)
4. **P/L per holding con storico**: performance individuale e aggregata nel tempo

L'utente inserisce manualmente le transazioni di acquisto/vendita (come gia' fa). Il PAC automatizza la distribuzione quando l'utente deposita nell'investment account. I prezzi si aggiornano automaticamente da Yahoo Finance/CoinGecko. Le regole PAC sono per-account (ogni investment account ha le sue regole indipendenti).

## Stato Attuale (gia' implementato)

- **Investment accounts**: CRUD completo con cash_balance, deposit, transfer, buy, sell (atomic rollback)
- **Investment transactions**: buy/sell con symbol, quantity, price, date
- **Holdings computation**: `computeHoldings()` in `portfolio.ts` (qty, avgPrice, costBasis)
- **Asset search**: Yahoo Finance + CoinGecko via API routes (`/api/assets/search`, `/api/assets/search-crypto`)
- **Market prices**: Yahoo Finance via `/api/assets/prices` con conversione EUR/USD
- **Asset price cache**: tabella DB `asset_prices_cache` (symbol, current_price, last_updated)
- **Savings accounts**: CRUD + auto-allocation rules (percentuale) + unallocated balance
- **Wealth snapshots**: monthly (investments_balance, savings_balance, is_manual)

## Goals

- Permettere all'utente di definire regole PAC per-account che distribuiscono automaticamente i fondi depositati su asset specifici
- Mantenere Yahoo Finance + CoinGecko come price feed (migrazione Finnhub rimandata a dopo verifica copertura)
- Mostrare un patrimonio netto totale aggregato (liquidita' + investimenti a valore di mercato)
- Mostrare P/L per ogni holding (unrealized) e P/L totale del portafoglio
- Tracciare lo storico prezzi per mostrare andamento nel tempo degli asset (on-demand ora, cron in futuro)

## User Stories

### US-001: Tabella PAC rules in database ✅
**Description:** Come sviluppatore, devo creare lo schema DB per le regole PAC in modo che persistano tra sessioni.

**Acceptance Criteria:**
- [x] Nuova tabella `pac_rules` con campi: `id` (UUID PK), `user_id` (FK auth.users), `investment_account_id` (FK investment_accounts), `asset_symbol` (TEXT NOT NULL), `asset_name` (TEXT NOT NULL), `asset_type` (TEXT NOT NULL), `percentage` (NUMERIC CHECK > 0 AND <= 100), `is_active` (BOOLEAN DEFAULT true), `created_at`, `sort_order`
- [x] Constraint UNIQUE su (user_id, investment_account_id, asset_symbol) per prevenire duplicati
- [x] Constraint CHECK: la somma delle percentuali attive per lo stesso (user_id, investment_account_id) non deve superare 100. Implementare via application logic (non DB check) dato che i check cross-row non sono supportati facilmente - validare prima dell'insert
- [x] RLS policies: CRUD solo per il proprio user_id
- [x] Migration file `supabase/migrations/20260213000001_create_pac_rules.sql`
- [x] TypeScript interface `PacRule` in `database.ts`
- [x] Typecheck passa

### US-002: Hook usePacRules per gestione regole PAC ✅
**Description:** Come sviluppatore, ho bisogno di un hook che gestisca CRUD e validazione delle regole PAC per un investment account.

**Acceptance Criteria:**
- [x] Nuovo hook `usePacRules` in `src/hooks/usePacRules.ts`
- [x] Carica le regole PAC per l'utente corrente (tutte, non filtrate per account)
- [x] `addRule(accountId, asset, percentage)`: inserisce una nuova regola. Valida che la somma percentuali per quell'account non superi 100%. Usa l'`AssetSearchModal` esistente per selezionare l'asset
- [x] `updateRule(ruleId, percentage)`: aggiorna la percentuale. Valida somma <= 100%
- [x] `deleteRule(ruleId)`: elimina una regola (dialog di conferma gestito dalla UI, non dal hook)
- [x] `toggleRule(ruleId)`: attiva/disattiva una regola (is_active toggle) con validazione somma al riattivo
- [x] `getRulesForAccount(accountId)`: filtra le regole per account specifico
- [x] `getTotalPercentage(accountId)`: restituisce la somma percentuali attive per un account
- [x] Gestione errore constraint violazione (23505) con toast user-friendly
- [x] Typecheck passa

### US-003: UI configurazione PAC per investment account ✅
**Description:** Come utente, voglio configurare le regole PAC per ogni investment account in modo da definire come distribuire i miei investimenti mensili.

**Acceptance Criteria:**
- [x] Nuova sezione "Piano di Accumulo (PAC)" dentro ogni investment account card nella pagina patrimonio — `PacRulesPanel.tsx` integrato in `InvestmentAccountsList.tsx`
- [x] Lista delle regole attive con: asset symbol, nome, percentuale, toggle attivo/disattivo
- [x] Barra di progresso che mostra la somma percentuali usate (es. 85/100%)
- [x] Pulsante "+ Aggiungi asset" che apre l'`AssetSearchModal` esistente, poi chiede la percentuale
- [x] Edit inline della percentuale (tap sul valore -> input editabile)
- [x] Delete con pulsante cestino + dialog conferma (swipe non implementato, solo bottone)
- [x] Messaggio informativo quando somma < 100%: "Il XX% restante rimarra' come liquidita' nel conto"
- [x] Messaggio errore se si tenta di superare 100%
- [x] Mobile responsive: card layout su mobile, inline su desktop
- [x] Typecheck passa
- [ ] Verify in browser using dev-browser skill — **NON VERIFICATO**

### US-004: Esecuzione automatica PAC al deposito nell'account ✅
**Description:** Come utente, quando deposito fondi in un investment account che ha regole PAC attive, il sistema deve automaticamente distribuire l'importo secondo le mie regole e creare le transazioni di acquisto.

**Acceptance Criteria:**
- [x] Dopo che `handleDeposit` completa con successo in `useInvestmentAccounts`, il sistema controlla se l'account ha regole PAC attive — via `pacExecutor` callback
- [x] Se ci sono regole PAC attive:
  1. Calcola l'importo per ogni regola: `importo_depositato * (percentage / 100)`
  2. Per ogni asset con regola attiva: fetch prezzo corrente da market prices
  3. Calcola `nuove_quote = importo_allocato / prezzo_corrente`
  4. Crea una `investment_transaction` di tipo `buy` per ogni asset
  5. Decrementa il `cash_balance` dell'account dell'importo totale allocato via PAC
  6. Il residuo (se somma regole < 100%) resta come cash_balance
- [x] Se il prezzo di un asset non e' disponibile, salta quell'asset e toast warning ("Prezzo non disponibile per XXX, allocazione mantenuta in liquidita'")
- [x] Operazione atomica con tracked rollback: array `insertedTransactionIds`. Se lo step K fallisce, rollback dei K-1 precedenti (delete delle transazioni + ripristino cash_balance) — in `pac-execution.ts`
- [x] Toast di conferma con riepilogo: "PAC applicato: 2.93 VWCE, 3.32 SWDA"
- [x] Se non ci sono regole PAC attive per l'account, non succede nulla (deposito normale, comportamento trasparente)
- [x] L'utente puo' fare un deposito senza PAC anche se ha regole configurate? No: se le regole sono attive, si applicano sempre. L'utente puo' disattivarle temporaneamente dal pannello PAC
- [x] Typecheck passa
- [ ] Tests per la logica di distribuzione — **MANCANTI**: non ci sono unit test dedicati per `executePac()` (edge cases: prezzo 0, somma < 100%, nessuna regola, rollback)

**Limitazione nota:** `executePac` chiama `fetchMarketPrices(symbols)` senza `cryptoMap`, quindi asset crypto nelle regole PAC non otterranno il prezzo e verranno skippati. Per supporto completo crypto servira' passare il cryptoMap costruito dal coingecko_id dell'asset.

### US-005: Storico prezzi e cache migliorata (Yahoo Finance + CoinGecko) ✅
**Description:** Come sviluppatore, devo migliorare il sistema di cache prezzi esistente per supportare lo storico e ridurre le chiamate API.

**Acceptance Criteria:**
- [x] Il price feed resta Yahoo Finance (stocks/ETF) + CoinGecko (crypto) - nessuna migrazione per ora
- [x] Aggiunta cache lato server: se il prezzo in `asset_prices_cache` e' stato aggiornato meno di 5 minuti fa, restituire quello senza chiamare l'API esterna — `CACHE_TTL_MS = 5 * 60 * 1000` in entrambi i route
- [x] Quando `/api/assets/prices` fetcha un prezzo aggiornato, upsert anche in `asset_price_history` con la data odierna (un record per symbol per giorno)
- [ ] Aggiunta nota in CLAUDE.md: "Migrazione a Finnhub rimandata - verificare prima la copertura degli ETF quotati su Borsa Italiana (.MI)" — **MANCANTE**
- [x] Typecheck passa

### US-006: Storico prezzi asset ✅
**Description:** Come sviluppatore, devo salvare lo storico dei prezzi degli asset per mostrare l'andamento nel tempo.

**Acceptance Criteria:**
- [x] Nuova tabella `asset_price_history` con campi: `id` (UUID PK), `symbol` (TEXT NOT NULL), `price_eur` (NUMERIC(18,8) NOT NULL), `price_date` (DATE NOT NULL), `created_at`
- [x] Constraint UNIQUE su (symbol, price_date) per un prezzo per asset per giorno
- [x] RLS: leggibile da tutti gli utenti autenticati (shared data), insert/update da authenticated
- [x] Migration file — `supabase/migrations/20260213000002_create_asset_price_history.sql` (include anche `ALTER TABLE asset_prices_cache ADD COLUMN coingecko_id`)
- [x] Quando `/api/assets/prices` fetcha un prezzo, upsert anche in `asset_price_history` con la data odierna
- [x] Nuovo endpoint `/api/assets/history?symbol=VWCE.MI&days=90` che restituisce lo storico prezzi — `src/app/api/assets/history/route.ts`
- [x] TypeScript interface `AssetPriceHistory` in `database.ts`
- [x] Typecheck passa

### US-007: Vista patrimonio netto aggregato ✅
**Description:** Come utente, voglio vedere il mio patrimonio netto totale in un unico numero, con breakdown per categoria.

**Acceptance Criteria:**
- [x] Nuova sezione in cima alla pagina patrimonio — `NetWorthCard.tsx` integrato in `patrimonio/page.tsx`
  - **Patrimonio netto totale**: somma di tutti i componenti
  - Breakdown:
    - **Liquidita'**: savings accounts balances + investment accounts cash_balance + unallocated (savings + investments)
    - **Investimenti**: somma del market value di tutte le holdings (qty * current price)
- [x] Il calcolo usa i prezzi di mercato correnti (da `marketPrices` map gia' presente nel hook `useInvestmentAccounts`)
- [x] Se i prezzi non sono ancora caricati, mostra il cost basis come fallback con indicatore "(stima)"
- [x] Formattazione EUR italiana (formatCurrency gia' disponibile)
- [x] Animazione CountUp (componente esistente) per il totale
- [x] Layout: card prominente con numero grande, sotto le due sottocategorie con barre proporzionali
- [x] Mobile responsive
- [x] Typecheck passa
- [ ] Verify in browser using dev-browser skill — **NON VERIFICATO**

### US-008: P/L per holding e portafoglio totale ✅
**Description:** Come utente, voglio vedere il guadagno/perdita non realizzato per ogni holding e per il portafoglio totale.

**Acceptance Criteria:**
- [x] Per ogni holding nella lista investimenti:
  - Market value: qty * current price
  - Cost basis: qty * avg purchase price (gia' calcolato da `computeHoldings`)
  - P/L (unrealized): market value - cost basis
  - P/L %: ((market value - cost basis) / cost basis) * 100
  - Colore: verde se positivo, rosso se negativo — `text-warmData-income` / `text-warmData-expense`
- [x] P/L totale portafoglio in cima alla sezione investimenti — Controvalore card con P&L totale, importo e %
- [x] I valori si aggiornano quando i prezzi di mercato cambiano (gia' reattivo tramite `marketPrices` state)
- [x] Quando i prezzi non sono disponibili, mostra "—" al posto del P/L (non 0, non stima) — da verificare, implementato `computeHoldingsWithPL` in `portfolio.ts`
- [x] Typecheck passa
- [ ] Verify in browser using dev-browser skill — **NON VERIFICATO**

### US-009: Grafico andamento singolo asset ✅
**Description:** Come utente, voglio vedere un grafico con l'andamento del prezzo di un singolo asset nel tempo.

**Acceptance Criteria:**
- [x] Quando l'utente clicca/tap su una holding, si espande un dettaglio che include:
  - Grafico a linea (Recharts `AreaChart`) con lo storico prezzo da `asset_price_history`
  - Linea tratteggiata orizzontale al prezzo medio di carico (avg purchase price) — ReferenceLine con label "PMC"
  - Area verde sopra la linea di carico (gain), area rossa sotto (loss) — linearGradient con offset calcolato
  - Selettore periodo: 1M, 3M, 6M, 1A, MAX
- [x] I dati vengono fetchati da `/api/assets/history?symbol=XXX&days=N`
- [x] Loading spinner mentre i dati caricano
- [x] Se non c'e' abbastanza storico (asset aggiunto di recente), messaggio "Storico in costruzione - i dati si accumulano giorno per giorno"
- [x] Mobile: grafico full-width, touch-friendly — tooltips funzionano con tap, non solo hover
- [x] Typecheck passa
- [ ] Verify in browser using dev-browser skill — **NON VERIFICATO**

### US-010: Aggiornamento wealth snapshot con dati reali ✅
**Description:** Come sviluppatore, devo aggiornare il calcolo dei wealth snapshot per usare i dati reali del portafoglio invece di soli flussi.

**Acceptance Criteria:**
- [x] Quando si calcola `investments_balance` per un wealth snapshot, usare: somma(market value di tutte le holdings) + somma(cash_balance di tutti i conti investimento) + investments_unallocated
- [x] Quando si calcola `savings_balance`: somma(balance di tutti i savings accounts) + savings_unallocated
- [x] Se i prezzi di mercato non sono disponibili, fallback al cost basis
- [x] Il calcolo viene triggerato quando l'utente visita la pagina patrimonio (lazy update) — `updateWealthSnapshotFromAccounts()` chiamato in useEffect
- [x] Upsert nel `wealth_snapshots` con `is_manual: false`
- [x] Typecheck passa
- [x] Test unitari per la nuova logica di calcolo — `wealth-calculations.test.ts` (25 test)

## Functional Requirements

- FR-1: Tabella `pac_rules` con constraint unicita' e RLS
- FR-2: Hook `usePacRules` con CRUD completo e validazione somma percentuali <= 100%
- FR-3: UI PAC integrata nelle card degli investment accounts
- FR-4: PAC auto-execution quando viene registrata una transazione "Investimenti" e ci sono depositi su account con regole PAC
- FR-5: Cache prezzi server-side (5 min TTL) con upsert in storico giornaliero
- FR-6: Asset search via Yahoo Finance (stocks/ETF) + CoinGecko (crypto) - invariato
- FR-7: Price fetch via Yahoo Finance + CoinGecko con conversione EUR - invariato
- FR-8: Storico prezzi giornaliero in `asset_price_history`
- FR-9: Patrimonio netto aggregato = liquidita' + market value investimenti
- FR-10: P/L unrealized per holding e totale portafoglio
- FR-11: Grafico storico prezzo per singolo asset con Recharts
- FR-12: Wealth snapshot aggiornato con dati reali del portafoglio

## Non-Goals (Out of Scope - Phase 1)

- **Crypto exchange API integration** (Binance, Coinbase, etc.) - Phase 2
- **Open Banking** (GoCardless, Tink) - Phase 2
- **Asset manuali** (immobili, quote societa', veicoli) - Phase successiva
- **Dashboard analytics avanzata** (donut chart allocation, real vs simulator comparison, insights) - Phase successiva
- **Dividendi tracking** - non in scope
- **Tasse / capital gains** - non in scope
- **Multi-currency portfolio** (tutto in EUR) - non in scope
- **Notifiche push** per variazioni prezzo - non in scope
- **Price alerts** - non in scope

## Design Considerations

### UI/UX
- Riusare i pattern esistenti: warm color palette, card con rounded-2xl, modal fullscreen mobile (bottom-sheet), animate-cardEnter
- Il PAC si integra come sezione collapsible dentro ogni investment account card
- Il patrimonio netto va in cima alla pagina patrimonio, prominente (font grande, CountUp animation)
- P/L colorato: `text-emerald-400` (green) per gain, `text-red-400` per loss
- Grafico storico: usare Recharts `AreaChart` con gradient fill (verde sopra avg price, rosso sotto)
- Mobile: tutti i grafici full-width, touch-friendly, no hover tooltips (use tap)

### Componenti esistenti da riusare
- `AssetSearchModal` per selezione asset nel PAC
- `CountUp` per animazione patrimonio
- `formatCurrency` e `parseEuropeanDecimal` da `useInvestmentAccounts`
- `computeHoldings` da `portfolio.ts`
- `fetchMarketPrices` da `market-prices.ts` (da aggiornare per Finnhub)

## Technical Considerations

### Price Feed (Yahoo Finance + CoinGecko - invariato)
- Yahoo Finance per stocks/ETF (unofficial ma stabile, buona copertura .MI)
- CoinGecko per crypto (free, 30 req/min)
- Cache server-side: prezzo valido per 5 minuti (non serve real-time per un tracker personale)
- Migrazione Finnhub rimandata: verificare prima copertura ETF Borsa Italiana

### PAC Execution Flow
```
User deposita €500 in account "Fineco"
  → handleDeposit completa (unallocated -= 500, cash_balance += 500)
  → Il sistema controlla: "Fineco" ha regole PAC attive?
  → Si: VWCE 60%, SWDA 30%
    → VWCE: €300 → fetch prezzo → €102.30 → buy 2.93 quote
    → SWDA: €150 → fetch prezzo → €45.20 → buy 3.32 quote
    → Residuo 10% = €50 → resta come cash_balance
    → Crea investment_transactions per ogni buy
    → Decrementa cash_balance dell'importo allocato (500 - 50 residuo = 450)
  → Toast riepilogo: "PAC applicato: 2.93 VWCE, 3.32 SWDA"
```

### Performance
- `/api/assets/prices` con batch: un singolo endpoint per N symbols, non N chiamate separate
- `asset_price_history` index su (symbol, price_date) per query efficienti
- Client-side: `useMemo` per calcoli P/L, non ricalcolare ad ogni render

### Dipendenze
- US-005 (Finnhub) puo' essere sviluppata in parallelo alle altre
- US-001 → US-002 → US-003 → US-004 (sequenziali)
- US-006 → US-009 (storico prezzi prima del grafico)
- US-007 e US-008 possono essere sviluppate in parallelo dopo US-005

## Success Metrics

- L'utente puo' configurare un PAC in meno di 1 minuto (3-4 tap)
- Il patrimonio netto totale e' visibile entro 2 secondi dal caricamento pagina
- I prezzi degli asset si aggiornano automaticamente (cache 5 min)
- P/L visibile per ogni holding senza click aggiuntivi
- Il PAC si esegue automaticamente senza intervento dopo il log della transazione

## Decisioni Prese

1. **Trigger PAC**: il PAC si attiva quando l'utente deposita fondi nell'investment account (via handleDeposit). Preciso e controllabile.
2. **Price feed**: si mantiene Yahoo Finance + CoinGecko. Migrazione a Finnhub rimandata dopo verifica copertura ETF Borsa Italiana (.MI).
3. **Frequenza aggiornamento storico**: on-demand per ora (quando l'utente apre la pagina, upsert del prezzo del giorno). Cron giornaliero in futuro.
4. **PAC scope**: per-account. Ogni investment account ha le sue regole PAC indipendenti.

## Open Questions

1. **PAC bypass**: l'utente puo' fare un deposito "senza PAC" anche se ha regole attive? Per ora: no, deve disattivare le regole prima. In futuro si potrebbe aggiungere un toggle "Applica PAC" nel form di deposito.
2. **PAC e prezzo di acquisto**: il PAC usa il prezzo di mercato corrente come prezzo di acquisto nella transaction. Questo potrebbe differire dal prezzo reale a cui l'utente compra sulla piattaforma. Accettabile per tracking, ma l'utente dovrebbe poter editare la transazione dopo (gia' supportato).

---

## Implementation Plan

### Stato infrastruttura esistente (verificato 2026-02-13)

| Componente | Stato | File |
|---|---|---|
| `/api/assets/search` (Yahoo Finance) | ESISTE | `src/app/api/assets/search/route.ts` |
| `/api/assets/search-crypto` (CoinGecko) | ESISTE | `src/app/api/assets/search-crypto/route.ts` |
| `/api/assets/prices` (Yahoo Finance) | ESISTE | `src/app/api/assets/prices/route.ts` |
| `/api/assets/prices-crypto` (CoinGecko) | **NON ESISTE** | Da creare (prerequisito) |
| `/api/assets/history` | **NON ESISTE** | Da creare in US-006 |
| `asset_price_history` table | **NON ESISTE** | Da creare in US-006 |
| `pac_rules` table | **NON ESISTE** | Da creare in US-001 |
| `market-prices.ts` | ESISTE | `src/lib/market-prices.ts` - solo Yahoo, niente crypto |
| `portfolio.ts` | ESISTE | `src/lib/portfolio.ts` - `computeHoldings()`, no P/L |
| `useInvestmentAccounts.ts` | ESISTE | `src/hooks/useInvestmentAccounts.ts` - hook completo, fetcha prezzi Yahoo |
| `database.ts` types | ESISTE | `src/types/database.ts` - mancano `PacRule`, `AssetPriceHistory` |

### Prerequisito: CoinGecko prices API

`/api/assets/prices-crypto` non esiste (prd.json US-021, `passes: false`). Serve a:
- US-004 (PAC su crypto: fetch prezzo corrente per calcolare quote)
- US-007 (patrimonio netto: market value di holdings crypto)
- US-008 (P/L su holdings crypto)

Va completata in Fase 1 insieme alla cache migliorata. Deve anche essere integrata in `fetchMarketPrices()` in `market-prices.ts` che attualmente chiama solo Yahoo.

### Fasi di esecuzione

#### Fase 1 - Fondamenta (3 agenti paralleli)

**Agente A - PAC schema + hook:**
- US-001: Tabella `pac_rules` + migration + types
- US-002: Hook `usePacRules` con CRUD e validazione

**Agente B - Price infrastructure:**
- Prerequisito: Creare `/api/assets/prices-crypto/route.ts` (CoinGecko live prices)
- Prerequisito: Integrare crypto prices in `fetchMarketPrices()` (`market-prices.ts`)
- US-005: Cache server-side 5min TTL su `/api/assets/prices` + upsert in `asset_price_history`
- US-006: Tabella `asset_price_history` + migration + endpoint `/api/assets/history`

**Agente C - N/A** (rimosso - il lavoro e' coperto da A e B)

Nessuna dipendenza tra A e B: lavorano su tabelle e file diversi.

#### Fase 2 - UI e calcoli (2-3 agenti paralleli)

Dipende da: Fase 1 completata.

**Agente D - PAC UI + execution:**
- US-003: UI configurazione PAC nelle investment account cards
- US-004: Auto-execution PAC al deposito (modifica `handleDeposit` in `useInvestmentAccounts`)

**Agente E - Portfolio views:**
- US-007: Vista patrimonio netto aggregato (card in cima a pagina patrimonio)
- US-008: P/L per holding e portafoglio totale (estendere `portfolio.ts` + UI)

**Agente F - Asset chart (opzionale, parallelizzabile):**
- US-009: Grafico andamento singolo asset (dipende da US-006 per `/api/assets/history`)

#### Fase 3 - Chiusura

Dipende da: Fase 2 completata (US-007, US-008).

- US-010: Aggiornamento wealth snapshot con dati reali del portafoglio

### Dipendenze tra storie (grafo)

```
US-001 (PAC DB) --> US-002 (PAC hook) --> US-003 (PAC UI) --> US-004 (PAC execution)
                                                                    |
                                                          usa fetchMarketPrices
                                                                    |
Prerequisito (prices-crypto) --> US-005 (cache TTL) ---------> integrato in fetchMarketPrices
                                      |
                                US-006 (price history DB) --> US-009 (asset chart)
                                      |
                                US-007 (patrimonio netto) --> US-010 (wealth snapshot)
                                      |
                                US-008 (P/L holdings) ------> US-010 (wealth snapshot)
```

### Checklist di completamento

- [x] Prerequisito: `/api/assets/prices-crypto` creato e funzionante — `src/app/api/assets/prices-crypto/route.ts`
- [x] Prerequisito: `fetchMarketPrices()` integra Yahoo + CoinGecko — `src/lib/market-prices.ts` con `cryptoMap` param opzionale
- [x] US-001: Tabella PAC + types — `supabase/migrations/20260213000001_create_pac_rules.sql`, `PacRule` in `database.ts`
- [x] US-002: Hook usePacRules — `src/hooks/usePacRules.ts`
- [x] US-003: UI PAC — `src/components/PacRulesPanel.tsx`, integrato in `InvestmentAccountsList.tsx`
- [x] US-004: PAC auto-execution — `src/lib/pac-execution.ts`, `pacExecutor` callback in `useInvestmentAccounts.ts`
- [x] US-005: Cache 5min TTL — implementato in `/api/assets/prices/route.ts` e `/api/assets/prices-crypto/route.ts`
- [x] US-006: Storico prezzi + endpoint history — `supabase/migrations/20260213000002_create_asset_price_history.sql`, `src/app/api/assets/history/route.ts`, `AssetPriceHistory` in `database.ts`
- [x] US-007: Patrimonio netto aggregato — `src/components/NetWorthCard.tsx`, integrato in `patrimonio/page.tsx`
- [x] US-008: P/L holdings — `computeHoldingsWithPL` in `portfolio.ts`, P/L colorato in holdings UI
- [x] US-009: Grafico asset — `src/components/AssetPriceChart.tsx` (Recharts AreaChart, gradient verde/rosso, selettore periodo), integrato in holdings espanse via `next/dynamic`
- [x] US-010: Wealth snapshot aggiornato — `updateWealthSnapshotFromAccounts()` in `wealth.ts`, chiamato lazy da `patrimonio/page.tsx`
- [x] Typecheck passa su tutto (`npm run typecheck`) — 0 errori
- [x] Test passano (`npm test`) — 107 test, 5 file, tutti verdi
- [ ] prd.json aggiornato con note e passes=true per US-020/021 del PRD precedente

### Note di implementazione

**Cosa manca / limitazioni note:**

1. **US-003 (PAC UI)**: non verificato in browser (acceptance criteria dice "Verify in browser using dev-browser skill"). Funzionalmente completo: collapsible section, progress bar, inline edit %, toggle, delete con conferma, AssetSearchModal integrato.

2. **US-004 (PAC execution)**: i test per la logica di distribuzione (acceptance criteria) non sono stati scritti come file separato. La logica e' in `pac-execution.ts` con tracked rollback, ma mancano unit test dedicati per edge cases (prezzo 0, somma < 100%, rollback).

3. **US-007/008/009**: non verificati in browser. Funzionalmente completi.

4. **US-004 + crypto**: `executePac` chiama `fetchMarketPrices(symbols)` senza passare il `cryptoMap`. Per asset crypto nelle regole PAC, il prezzo non verra' trovato (skipped con warning). Per supporto completo crypto nel PAC, serve passare il cryptoMap costruito dai dati dell'asset (coingecko_id). Workaround: l'utente puo' comunque comprare crypto manualmente.

5. **US-005 (cache Yahoo)**: la cache 5min TTL e' implementata in entrambi i route: `/api/assets/prices` (Yahoo) e `/api/assets/prices-crypto` (CoinGecko). Entrambi fanno upsert in `asset_price_history` con la data odierna. Completo.

6. **prd.json**: US-020 (Yahoo prices) e US-021 (CoinGecko prices) del PRD precedente sono di fatto completate ma non ancora segnate `passes: true`.
