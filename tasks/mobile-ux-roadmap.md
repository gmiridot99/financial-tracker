# Mobile UX Transformation - Piano di Battaglia

> **Stato**: COMPLETATO
> **Ultimo aggiornamento**: 2026-02-13
> **Target**: Esperienza mobile-first su schermi 320px-428px, tablet fino a 768px

---

## Discovery Summary

### Pagine identificate (10)
| Pagina | Route | Priorita Mobile |
|---|---|---|
| Monthly Dashboard | `/dashboard/[year]/[month]` | ALTA |
| Patrimonio | `/dashboard/patrimonio` | ALTA |
| Simulator | `/dashboard/simulator` | CRITICA |
| Annual Recap | `/dashboard/[year]/recap` | MEDIA |
| Multi-Year Recap | `/dashboard/recap` | MEDIA |
| Login | `/login` | BASSA |
| Register | `/register` | BASSA |
| Settings | `/settings` | BASSA |
| Homepage | `/` | BASSA (redirect) |
| Dashboard redirect | `/dashboard` | BASSA (redirect) |

### Componenti critici (35+)
- ~~**Nessun Layout condiviso**: ogni pagina ha navigazione ad-hoc~~ RISOLTO: `AppLayout` + `MobileNavBar`
- ~~**Nessun Menu globale**: la dashboard ha 6 icon buttons in riga nel top bar~~ RISOLTO: Bottom nav 4 tab
- ~~**MilestoneTable**: `grid-cols-8` con 8 colonne di input numerici - INUTILIZZABILE su mobile~~ RISOLTO: dual view (tabella desktop + card mobile)
- **TransactionModal**: modale che potrebbe non essere full-screen su mobile
- **Charts (Recharts)**: 5 grafici diversi, responsive di default ma da verificare
- **Inline Forms**: 3 form collassabili nella dashboard - pattern buono ma da ottimizzare

---

## Gap Analysis - Problemi Critici Identificati

### 1. Navigazione Globale Assente (Severity: CRITICA)
- Non esiste un componente di navigazione condiviso
- Ogni pagina implementa la propria top bar
- Dashboard top bar: 6 bottoni icona in riga (`CheckSquare`, `BarChart3`, `TrendingUp`, `Wallet`, `Calculator`, `LogOut`) che possono overflow su schermi <375px
- Pagine secondarie usano `ArrowLeft` per tornare indietro, senza modo di navigare altrove
- Nessuna bottom navigation bar (pattern standard mobile per fintech)

### 2. MilestoneTable - Tabella a 8 Colonne (Severity: CRITICA)
- `grid-cols-8`: label + 6 milestone + delete = completamente rotto su mobile
- Ogni riga ha 6 input numerici affiancati
- Righe: Stipendio, Investimento, N spese dinamiche, Totale
- Richiede ripensamento totale: card-per-milestone o scroll orizzontale con sticky labels

### 3. Simulator Page - Layout Desktop-Only (Severity: CRITICA)
- Container `max-w-7xl` con `p-6` non adatto a mobile
- Config section: `grid md:grid-cols-4` per 4 input affiancati
- Return rates: `grid grid-cols-2` (OK su tablet, stretto su telefono)
- Header con 5+ bottoni azione affiancati (Carica, Salva, Export, Simula)
- Testi helper sotto ogni input occupano troppo spazio verticale

### 4. Touch Targets Insufficienti (Severity: ALTA)
- Bottoni dashboard: `w-9 h-9` = 36px (minimum raccomandato: 44px)
- Delete buttons: `p-2` = ~32px totali
- Bottoni che appaiono solo su `group-hover:opacity-100` - invisibili su touch
- Input `h-11` (44px) nelle forms - OK

### 5. Testo Troppo Piccolo (Severity: ALTA)
- Wealth pills: `text-[11px]` - illeggibile su mobile
- Uso estensivo di `text-xs` (12px) - borderline per leggibilita mobile (min consigliato: 14px)
- Label helper nel simulator: `text-xs text-warmText-disabled` su sfondo scuro

### 6. Modali Non Ottimizzate (Severity: MEDIA)
- `TransactionModal`: potrebbe non coprire fullscreen su mobile
- `SaveSimulationDialog`: dimensioni non responsive
- `LoadSimulationMenu`: dropdown posizionato `relative` - potrebbe uscire dallo schermo
- `AssetSearchModal`: interfaccia di ricerca asset - deve essere full-screen su mobile

### 7. Toast Positioning (Severity: BASSA)
- `position="top-right"` nel `Toaster` - su mobile dovrebbe essere `top-center` o `bottom-center`

---

## Roadmap Implementativa

### Fase 1: Global Navigation & Shell (Fondamenta)

> Senza questo, nessuna pagina funziona correttamente su mobile.

- [x] **1.1 Creare un componente `MobileShell`/`AppLayout`** condiviso per tutte le pagine autenticate
  - `src/components/layout/AppLayout.tsx`: wrapper con `pb-20 md:pb-0`, route-aware navbar
  - `src/components/layout/MobileNavBar.tsx`: bottom nav con safe-area

- [x] **1.2 Implementare Bottom Navigation Bar** per mobile (< 768px)
  - 4 tab: Dashboard, Patrimonio, Simulatore, Impostazioni
  - Icone: `LayoutDashboard`, `Wallet`, `Calculator`, `Settings`
  - Tab attivo con `warmAccent-primary`, route matching con regex
  - `fixed bottom-0`, `md:hidden`, `h-[env(safe-area-inset-bottom)]`

- [x] **1.3 Rifattorizzare Header della Dashboard**
  - Navigazione spostata nella Bottom Bar
  - Header compatto su mobile

- [x] **1.4 Standardizzare header pagine secondarie**
  - Navigazione globale via `MobileNavBar`, header locali semplificati

- [x] **1.5 Rendere `Toaster` responsive**
  - Estratto `ResponsiveToaster` client component con `useMediaQuery`
  - `top-center` su mobile (< 768px), `top-right` su desktop

---

### Fase 2: Core Pages (Dashboard, Patrimonio, Simulator)

#### 2A: Monthly Dashboard (`/dashboard/[year]/[month]`)

- [x] **2A.1 Ottimizzare Hero Balance zone per mobile**

- [x] **2A.2 Wealth summary pills** (ancora `text-[11px]` nella dashboard)
  - Aumentare `text-[11px]` a `text-xs` (12px) minimum su mobile
  - Se pills overflow, wrappare su 2 righe con `flex-wrap`

- [x] **2A.3 Inline Forms responsivi**

- [x] **2A.4 TransactionGroup e TransactionCard**

#### 2B: Patrimonio (`/dashboard/patrimonio`)

- [x] **2B.1 Tab switcher Risparmi/Investimenti**

- [x] **2B.2 Account Cards responsive** (ancora `w-9 h-9` per bottoni in patrimonio)
  - Bottoni azione: touch target `w-9 h-9` (36px) da portare a 44px
  - Verificare form inline deposito/trasferimento su mobile

- [x] **2B.3 Unallocated balance editing**
  - Bottoni Check/X: aumentare touch target

- [x] **2B.4 Investment holdings expandable**
  - AssetSearchModal: gia full-screen su mobile (`w-full h-full`, `sm:max-w-2xl sm:rounded-2xl`)

- [x] **2B.5 Charts (SavingsPerformanceChart, InvestmentPerformanceChart)**

#### 2C: Simulator (`/dashboard/simulator`) - IL PIU CRITICO

- [x] **2C.1 Header e toolbar responsivi**
  - Implementato: bottoni in `grid grid-cols-2 sm:flex` su mobile

- [x] **2C.2 Configurazione Globale responsive**
  - Return rates: `grid-cols-1 md:grid-cols-2`

- [x] **2C.3 MilestoneTable - REWORK COMPLETO**
  - Implementata Opzione A+B: `hidden md:block` (tabella desktop) + `md:hidden` (card per milestone su mobile)

- [x] **2C.4 DebtsList responsive**

- [x] **2C.5 SimulatorChart responsive**

- [x] **2C.6 ResultsSummary e MilestonesCards**

---

### Fase 3: Secondary Pages (Recap, Login, Settings)

#### 3A: Annual Recap (`/dashboard/[year]/recap`)

- [x] **3A.1 AnnualTrendChart responsivo**
  - Padding ridotto su mobile (`p-4 md:p-6`), margini chart ottimizzati
  - `ResponsiveContainer` gestisce bene 12 mesi, altezza ridotta a 280px

- [x] **3A.2 AnnualInsights cards**
  - Gia responsive: `grid-cols-2 lg:grid-cols-3` - OK per mobile

- [x] **3A.3 CategoryBreakdownChart**
  - Rimossi label inline (overlap su mobile), aggiunta Legend con percentuali
  - Donut ridotto (`innerRadius=50 outerRadius=85`), padding responsive

- [x] **3A.4 YearComparisonCards**
  - Gia responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` - OK per mobile

#### 3B: Multi-Year Recap (`/dashboard/recap`)

- [x] **3B.1 Year range selectors**
  - Select: `text-base md:text-lg` (previene iOS zoom)
  - Titolo aggregato: `text-3xl md:text-4xl`

- [x] **3B.2 Wealth summary table/cards**
  - Gia responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` e `grid-cols-1 md:grid-cols-3`

#### 3C: Login & Register

- [x] **3C.1 Login page**
  - Input: `text-base md:text-sm` (previene iOS zoom)
  - Layout gia mobile-ready (`max-w-md w-full px-4`)

- [x] **3C.2 Register page**
  - Input: `text-base md:text-sm` (previene iOS zoom)
  - Layout gia mobile-ready

#### 3D: Settings

- [x] **3D.1 Settings page**
  - Padding: `py-4 md:py-8`
  - Bottoni `flex-1` gia adattivi

---

### Fase 4: Micro-Interactions & Polish

#### 4A: Touch Targets

- [x] **4A.1 Aumentare tutti i bottoni icona a minimo 44x44px**
  - Dashboard top bar: `w-9 h-9` (36px) -> `w-11 h-11` (44px)
  - Delete buttons nel MilestoneTable: `p-2` -> `p-3` su mobile
  - Month navigation: gia `w-11 h-11` - OK

- [x] **4A.2 Rimuovere interazioni hover-only**
  - MilestoneTable delete button: `opacity-0 group-hover:opacity-100` -> sempre visibile su mobile (via `md:opacity-0 md:group-hover:opacity-100`)
  - DebtCard action buttons: idem
  - Qualsiasi altro elemento che appare solo su hover

#### 4B: Font Size

- [x] **4B.1 Minimum font size 12px su mobile**
  - Eliminare `text-[11px]` - usare almeno `text-xs` (12px)
  - Per dati finanziari importanti: minimo `text-sm` (14px) su mobile

- [x] **4B.2 Revisione leggibilita label e helper text**
  - `text-warmText-disabled` -> `text-warmText-tertiary` per contrasto WCAG migliorato
  - Helper text nel simulator: `hidden md:block` (nascosti su mobile)
  - ResultsSummary: descrizioni sotto le card nascoste su mobile, percentuali visibili

#### 4C: Modali & Overlay

- [x] **4C.1 TransactionModal full-screen su mobile**
  - Mobile: fullscreen con `animate-sheetSlideUp`, `items-end` per slide-up
  - Desktop (sm+): overlay centrato con `max-w-md`, `rounded-2xl`

- [x] **4C.2 SaveSimulationDialog responsive**
  - Mobile: fullscreen con `flex-col` e `mt-auto` per bottoni in basso
  - Desktop (sm+): dialog centrato con `max-w-md`, `rounded-2xl`

- [x] **4C.3 LoadSimulationMenu come bottom sheet su mobile**
  - Mobile: `fixed bottom-0` bottom sheet con drag handle, `rounded-t-2xl`, backdrop dimmed
  - Desktop (sm+): `absolute` dropdown posizionato, backdrop trasparente
  - Delete button: sempre visibile su mobile (`sm:opacity-0 sm:group-hover:opacity-100`)

- [x] **4C.4 AssetSearchModal full-screen su mobile**
  - Gia implementato: `w-full h-full` mobile, `sm:max-w-2xl sm:rounded-2xl` desktop

#### 4D: Scroll & Gesture

- [x] **4D.1 Pull-to-refresh sulla dashboard mensile**
  - Touch events nativi: pull-down quando `scrollY === 0` mostra spinner
  - Soglia 60px per attivazione, ricarica transazioni e wealth data
  - Nessuna dipendenza esterna

- [x] **4D.2 Swipe per navigare tra mesi**
  - Touch events nativi: swipe left = mese successivo, swipe right = mese precedente
  - Soglia 60px, check che movimento orizzontale > verticale * 1.5
  - Max 500ms per completare lo swipe (evita trigger accidentali)

- [x] **4D.3 Safe area insets**
  - `MobileNavBar`: `h-[env(safe-area-inset-bottom)]` gia presente

#### 4E: Performance Mobile

- [x] **4E.1 Verificare performance rendering charts su mobile**
  - Lazy loading con `dynamic(() => import(...), { ssr: false })` applicato a:
    - `AnnualTrendChart`, `CategoryBreakdownChart`, `YearComparisonCards`, `AnnualInsights` (recap page)
    - `SimulatorChart` (simulator page)
    - `MonthlyFlowChart` (dashboard mensile)
    - `MultiYearTrendChart` (multi-year recap)
    - `SavingsPerformanceChart`, `InvestmentPerformanceChart` (patrimonio)

- [x] **4E.2 Ridurre animazioni su prefer-reduced-motion**
  - Aggiunta regola globale in `globals.css`: `@media (prefers-reduced-motion: reduce)` che azzera `animation-duration` e `transition-duration`
  - Copre tutti gli `animate-cardEnter`, `animate-sheetSlideUp`, e transitions custom

---

## Note Architetturali

### Breakpoint Strategy
- **Mobile**: < 640px (`sm:`)
- **Tablet**: 640px - 767px
- **Desktop**: >= 768px (`md:`)
- Approccio: aggiungere classi responsive Tailwind (`sm:`, `md:`, `lg:`) dove servono, senza riscrivere il CSS

### Cosa NON fare
- Non introdurre una sidebar mobile (l'app non ha sidebar desktop)
- Non usare librerie UI pesanti (Radix, Headless UI) solo per il mobile - CSS puro + Tailwind bastano
- Non duplicare componenti per mobile/desktop - usare responsive classes
- Non nascondere funzionalita su mobile - tutto deve essere accessibile

### Dipendenze potenziali
- Nessuna nuova dipendenza strettamente necessaria
- Opzionale: `react-swipeable` per gesture swipe (< 3KB gzipped)
- Opzionale: `use-media-query` hook custom (poche righe) per logica condizionale JS

---

## Priorita di Esecuzione

| # | Task | Impatto | Effort | Stato |
|---|---|---|---|---|
| ~~1~~ | ~~Fase 1.1-1.2: AppLayout + Bottom Nav~~ | ~~Critico~~ | ~~Medio~~ | FATTO |
| ~~2~~ | ~~Fase 2C.3: MilestoneTable rework~~ | ~~Critico~~ | ~~Alto~~ | FATTO |
| ~~3~~ | ~~Fase 1.3: Rifattorizzare header dashboard~~ | ~~Critico~~ | ~~Basso~~ | FATTO |
| ~~4~~ | ~~Fase 2C.1-2C.2: Simulator layout~~ | ~~Alto~~ | ~~Medio~~ | FATTO |
| ~~5~~ | ~~Fase 4A.1-4A.2: Touch targets~~ | ~~Alto~~ | ~~Basso~~ | FATTO |
| ~~6~~ | ~~Fase 2B.4: AssetSearchModal fullscreen~~ | ~~Alto~~ | ~~Basso~~ | FATTO |
| ~~7~~ | ~~Fase 4C.1-4C.3: Modali fullscreen + bottom sheet~~ | ~~Medio~~ | ~~Basso~~ | FATTO |
| ~~8~~ | ~~Fase 2A.1-2A.4: Dashboard polish~~ | ~~Medio~~ | ~~Basso~~ | FATTO (tranne 2A.2 pills) |
| ~~9~~ | ~~Fase 3A-3D: Secondary pages~~ | ~~Basso~~ | ~~Basso~~ | FATTO |
| ~~10~~ | ~~Fase 4D: Gesture e polish~~ | ~~Basso~~ | ~~Medio~~ | FATTO |
