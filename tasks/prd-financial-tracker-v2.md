# PRD: Financial Tracker v2 - Dark Theme, Patrimonio Fixes & Desktop Layout

## Introduction

Quattro aree di miglioramento per il Financial Tracker: redesign del tema colori verso uno stile fintech moderno con sottotono freddo, fix del bug di persistenza dei saldi non destinati nel patrimonio, aggiunta del prezzo di acquisto con default da market price, e redesign del layout desktop della sezione patrimonio con grafici a torta per la distribuzione.

## Goals

- Sostituire la palette warm/marrone con un tema scuro a sottotono freddo (blu/viola), moderno e pulito
- Garantire che le modifiche manuali ai saldi "non destinati" persistano tra i refresh
- Pre-popolare il prezzo di acquisto con il prezzo di mercato cached quando si compra un asset
- Ottimizzare il layout patrimonio per desktop con layout a 2 colonne e grafici distribuzione

## User Stories

---

### US-001: Definire nuova palette colori con sottotono freddo
**Description:** As a developer, I need to replace the warm brown color tokens in Tailwind config with a cool-toned dark palette so that the entire app gets a modern fintech look.

**Acceptance Criteria:**
- [ ] `tailwind.config.ts`: sostituire tutti i token `warmBg-*` con nuovi valori a sottotono freddo/blu (es. `#0B0D11`, `#12151A`, `#1A1E26`, `#232830`)
- [ ] `warmText-*`: aggiornare con bianchi/grigi neutro-freddi (es. primary `#F0F2F5`, secondary `#8B95A5`, tertiary `#5A6474`)
- [ ] `warmAccent-*`: scegliere un accent moderno (blu elettrico, viola, o ciano) al posto dell'arancione
- [ ] `warmData-*`: mantenere colori semantici (verde income, rosso expense) ma armonizzati con la nuova palette
- [ ] Aggiornare `globals.css`: gradient hero e qualsiasi colore hardcoded
- [ ] Typecheck passa (`npm run typecheck`)

### US-002: Aggiornare componenti core alla nuova palette
**Description:** As a user, I want the entire app to use the new color scheme consistently so that the experience feels cohesive.

**Acceptance Criteria:**
- [ ] Login/Register pages usano i nuovi colori di sfondo e accent
- [ ] Dashboard mensile (cards, grafici, transaction list) usa i nuovi token
- [ ] Settings page aggiornata
- [ ] Tutti i modali (TransactionModal, AssetSearchModal, ecc.) usano i nuovi colori
- [ ] Bottom navbar mobile usa la nuova palette
- [ ] Nessun colore warm brown residuo visibile nell'app
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-003: Aggiornare grafici Recharts alla nuova palette
**Description:** As a user, I want charts to match the new dark theme with cool accent colors so that data visualization is consistent with the rest of the UI.

**Acceptance Criteria:**
- [ ] `AnnualTrendChart`: aggiornare gradienti, colori linee, tooltip background
- [ ] `CategoryBreakdownChart`: aggiornare colori categorie e sfondo
- [ ] `MonthlyFlowChart`: aggiornare colori barre
- [ ] `SavingsPerformanceChart` e `InvestmentPerformanceChart`: nuovi gradienti
- [ ] `SimulatorChart`: aggiornare colori layers
- [ ] Tooltip e legend usano i nuovi token di background e testo
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

---

### US-004: Persistere le modifiche manuali ai saldi non destinati
**Description:** As a user, when I manually edit the savings or investments unallocated balance in the patrimonio section, I want that value to persist after page refresh so that my manual adjustments are not lost.

**Acceptance Criteria:**
- [ ] Aggiungere colonna `savings_manual_override` (BOOLEAN, default FALSE) a `unallocated_balances`
- [ ] Aggiungere colonna `investments_manual_override` (BOOLEAN, default FALSE) a `unallocated_balances`
- [ ] Quando l'utente edita il saldo non destinati savings: salvare il nuovo valore E settare `savings_manual_override = TRUE`
- [ ] Quando l'utente edita il saldo non destinati investimenti: salvare il nuovo valore E settare `investments_manual_override = TRUE`
- [ ] `recalculateUnallocated()`: se `manual_override = TRUE` per un campo, NON ricalcolarlo. Restituire il valore salvato in DB
- [ ] Quando viene aggiunta una NUOVA transazione (income/expense) nel mese corrente: applicare il delta della nuova transazione sopra il valore override (non ricalcolare da zero), poi resettare `manual_override = FALSE`
- [ ] Migration SQL per aggiungere le colonne
- [ ] Typecheck passa
- [ ] Test unitari per `recalculateUnallocated()` con e senza override

### US-005: Aggiornare la pagina patrimonio per rispettare gli override
**Description:** As a user, I want the patrimonio page to correctly load and display manually overridden unallocated balances.

**Acceptance Criteria:**
- [ ] `loadUnallocated()` nella pagina patrimonio: controlla i flag override prima di chiamare `recalculateUnallocated()`
- [ ] L'edit inline dei saldi non destinati chiama l'API/funzione che setta il flag override
- [ ] Dopo refresh della pagina, i valori editati manualmente restano come li ha messi l'utente
- [ ] Se l'utente aggiunge una transazione dal dashboard mensile e poi torna al patrimonio, il delta e' applicato correttamente
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

---

### US-006: Aggiungere campo prezzo di acquisto nel form di buy
**Description:** As a user, when I buy an asset, I want the purchase price field to be pre-populated with the current market price from cache so that I can quickly confirm or adjust it.

**Acceptance Criteria:**
- [ ] Nel form di acquisto (`InvestmentAccountsList` o componente dedicato): il campo `price_per_unit` viene pre-popolato con il prezzo da `asset_prices_cache` per il simbolo selezionato
- [ ] Se il prezzo non e' in cache (asset mai cercato prima), il campo resta vuoto con placeholder "Inserisci prezzo"
- [ ] L'utente puo' modificare liberamente il prezzo pre-popolato
- [ ] Mostrare sotto il campo: "Prezzo di mercato: EUR X.XX" come riferimento (anche quando l'utente modifica il valore)
- [ ] Il `total_amount` si ricalcola in tempo reale: `quantity * price_per_unit`
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

---

### US-007: Layout desktop 2 colonne per patrimonio
**Description:** As a user on desktop, I want the patrimonio page to use a two-column layout (accounts on the left, charts on the right) so that I have better visibility of my wealth data.

**Acceptance Criteria:**
- [ ] Breakpoint `lg` (1024px+): layout a 2 colonne. Sotto `lg`: layout single-column come attuale
- [ ] Rimuovere `max-w-xl` su desktop, usare `max-w-6xl` o container piu' ampio
- [ ] Colonna sinistra (~60%): NetWorthCard (full-width sopra le 2 colonne), unallocated cards, tab bar, lista conti
- [ ] Colonna destra (~40%): grafici performance (savings o investments in base al tab attivo) + grafico distribuzione
- [ ] La colonna destra deve essere `sticky top-4` per restare visibile durante lo scroll dei conti
- [ ] Su mobile: layout invariato (single-column, max-w-xl)
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-008: Grafico a torta distribuzione per asset
**Description:** As a user, I want to see a pie chart showing how my wealth is distributed across different assets (stocks, ETFs, crypto, etc.) so that I can visualize my diversification.

**Acceptance Criteria:**
- [ ] Nuovo componente `WealthDistributionChart` con grafico a torta (Recharts `PieChart`)
- [ ] Dati: per ogni holding, calcolare il valore di mercato corrente (`quantity * current_price`) e mostrare la percentuale sul totale
- [ ] Includere anche "Liquidita" (somma cash_balance di tutti i conti investimento + savings totali) come slice
- [ ] Colori distinti per ogni asset/categoria, label leggibili
- [ ] Tooltip: nome asset, valore EUR, percentuale
- [ ] Stato vuoto se non ci sono holdings
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-009: Grafico a torta distribuzione per conto
**Description:** As a user, I want to see a pie chart showing how my wealth is distributed across my different accounts so that I can see which accounts hold the most value.

**Acceptance Criteria:**
- [ ] Stesso componente `WealthDistributionChart` con modalita' "per conto"
- [ ] Dati: per ogni conto savings (balance) e ogni conto investimento (cash_balance + market value holdings), mostrare la percentuale
- [ ] Includere "Non destinati savings" e "Non destinati investimenti" come slices separate
- [ ] Colori distinti per ogni conto
- [ ] Tooltip: nome conto, valore EUR, percentuale
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

### US-010: Toggle smooth tra i due grafici a torta
**Description:** As a user, I want to smoothly switch between the asset distribution and account distribution pie charts with an animated toggle.

**Acceptance Criteria:**
- [ ] Toggle pill/segmented control sopra il grafico a torta: "Per Asset" | "Per Conto"
- [ ] Transizione smooth tra i due grafici: fade + leggero slide (CSS transition, no librerie extra)
- [ ] Il toggle mantiene lo stato durante la sessione (non resetta cambiando tab savings/investimenti)
- [ ] Stile del toggle coerente con la nuova palette scura
- [ ] Typecheck passa
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

### Dark Theme
- FR-1: Sostituire tutti i valori `warmBg-*` in `tailwind.config.ts` con palette a sottotono freddo (blu/viola)
- FR-2: Sostituire tutti i valori `warmText-*` con grigi neutro-freddi
- FR-3: Sostituire `warmAccent-*` con accent color moderno (blu/ciano/viola)
- FR-4: Aggiornare `warmData-*` mantenendo semantica (verde=income, rosso=expense) ma armonizzati
- FR-5: Aggiornare `globals.css` (gradient hero, scrollbar, animazioni)
- FR-6: Aggiornare tutti i componenti che usano colori hardcoded (non token)
- FR-7: Aggiornare colori nei grafici Recharts (gradienti, tooltip, legend)

### Patrimonio Persistence
- FR-8: Aggiungere colonne `savings_manual_override` e `investments_manual_override` (BOOLEAN) a `unallocated_balances`
- FR-9: Settare il flag override a TRUE quando l'utente edita manualmente il saldo
- FR-10: `recalculateUnallocated()` deve saltare il ricalcolo per i campi con override=TRUE
- FR-11: Quando una nuova transazione viene aggiunta: calcolare il delta, applicarlo sopra il valore override, resettare il flag a FALSE
- FR-12: La pagina patrimonio deve leggere i flag override prima di decidere se ricalcolare

### Investment Purchase Price
- FR-13: Pre-popolare il campo `price_per_unit` con il prezzo da `asset_prices_cache` quando l'utente seleziona un asset
- FR-14: Mostrare il prezzo di mercato come label di riferimento sotto il campo input
- FR-15: Ricalcolare `total_amount = quantity * price_per_unit` in tempo reale

### Desktop Layout & Charts
- FR-16: Layout 2 colonne (60/40) su breakpoint `lg+` nella pagina patrimonio
- FR-17: NetWorthCard full-width sopra le 2 colonne, conti a sinistra, grafici a destra (sticky)
- FR-18: Grafico a torta "Per Asset": valore di mercato di ogni holding + liquidita
- FR-19: Grafico a torta "Per Conto": valore di ogni conto (savings balance + investment cash + holdings market value)
- FR-20: Toggle animato (pill/segmented) per switchare tra i due grafici a torta
- FR-21: Su mobile il layout resta single-column invariato

## Non-Goals (Out of Scope)

- **Light mode / theme toggle**: non implementiamo un toggle chiaro/scuro, solo il tema scuro
- **Fetch real-time price on buy**: usiamo solo il prezzo da cache, non chiamate API extra al momento dell'acquisto
- **Ricalcolo retroattivo**: le transazioni passate (prima dell'override) non vengono riallineate
- **Animazioni complesse sui grafici**: transizioni CSS semplici, niente librerie di animazione (framer-motion, react-spring)
- **Persistenza della scelta pie chart**: il toggle tra "Per Asset" e "Per Conto" e' in-memory, non salvato in DB
- **Redesign di pagine non-patrimonio per il layout desktop**: il focus del layout 2 colonne e' solo sulla pagina patrimonio

## Design Considerations

### Palette di riferimento (sottotono freddo)
- **Background primary**: `#0B0D11` - nero con leggero blu
- **Background secondary**: `#12151A` - cards
- **Background tertiary**: `#1A1E26` - inputs, hover areas
- **Background hover**: `#232830` - hover states
- **Text primary**: `#F0F2F5` - bianco leggermente freddo
- **Text secondary**: `#8B95A5` - grigio medio freddo
- **Text tertiary**: `#5A6474` - grigio scuro freddo
- **Accent primary**: da definire in fase di implementazione. Opzioni: `#3B82F6` (blu), `#8B5CF6` (viola), `#06B6D4` (ciano)
- **Data colors**: verde `#34D399`, rosso `#F87171`, viola `#A78BFA` (investments), blu `#38BDF8` (savings)

### Pie Charts
- Usare Recharts `PieChart` + `Pie` + `Cell` con colori distinti
- Inner radius per effetto donut (piu' moderno)
- Label percentuale visibile
- Tooltip custom con sfondo `warmBg-tertiary`

### Toggle Animation
- CSS `transition-all duration-300` sul container
- Opacity + translateX per il cambio tra i due chart
- Segmented control con pill indicator animata

## Technical Considerations

- I nomi dei token Tailwind (`warmBg-*`, `warmText-*`, ecc.) restano gli stessi per evitare un refactor massivo. Cambiano solo i VALORI hex
- La migration SQL per le colonne override deve avere default FALSE per i record esistenti
- `asset_prices_cache` gia' esiste e ha il prezzo; basta fare una query per simbolo quando l'utente seleziona l'asset nel form buy
- Il layout 2 colonne usa CSS Grid o Flexbox Tailwind (`lg:grid lg:grid-cols-5 lg:gap-6` con `lg:col-span-3` + `lg:col-span-2`)
- `WealthDistributionChart` riceve i dati come prop, non fa query dirette. La pagina patrimonio calcola e passa i dati

## Success Metrics

- Tutta l'app usa la nuova palette senza residui della vecchia (verifica visiva)
- I saldi non destinati editati manualmente persistono dopo refresh (test manuale + unit test)
- Il campo prezzo si pre-popola correttamente dal cache (test manuale)
- Su desktop (lg+) il layout patrimonio mostra 2 colonne con grafici a destra
- Il toggle tra i pie chart ha transizione smooth senza flicker

## Open Questions

1. Quale accent color preferisci? Blu (`#3B82F6`), viola (`#8B5CF6`), o ciano (`#06B6D4`)? O una combinazione?
2. Il delta delle nuove transazioni sugli override: deve applicarsi solo alle transazioni del mese corrente o a qualsiasi nuova transazione?
3. Per il pie chart "Per Asset": gli asset con valore < 1% del totale devono essere raggruppati in "Altro"?
