# Patrimonio Charts Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere donut chart nel NetWorthCard, PortfolioTrendChart full-width, e savings-only pie nel tab Risparmi.

**Architecture:**
- `NetWorthCard` diventa split layout (bars sx, donut dx su desktop; stacked su mobile)
- Nuovo `PortfolioTrendChart` tra NetWorthCard e tab bar
- `WealthDistributionChart` ottiene prop `title` opzionale; nel tab Risparmi viene usato filtrato solo sui savings accounts
- Il `WealthDistributionChart` always-visible (per-asset/per-conto toggle) si sposta dentro il tab Investimenti

**Tech Stack:** Next.js 14, Recharts, Tailwind CSS, Supabase (wealth_snapshots), TypeScript strict

---

### Stato pre-task (già completato)

- `SavingsPerformanceChart.tsx` — già aggiornato con prop `accounts`, per-account area chart, logica ricostruzione via transfers ✅
- `patrimonio/page.tsx` — `savingsAccountsData` ha già `id`, passa `accounts={savingsAccountsData}` a `SavingsPerformanceChart` ✅

---

### Task 1: Aggiungere prop `title` a `WealthDistributionChart`

**Files:**
- Modify: `src/components/WealthDistributionChart.tsx`

**Step 1: Aggiungere `title` alle props**

In `WealthDistributionChartProps` (riga ~19):
```ts
interface WealthDistributionChartProps {
  mode: DistributionMode;
  assetData: AssetSlice[];
  accountData: AccountSlice[];
  title?: string; // <-- aggiungere
}
```

**Step 2: Distruttare la prop e usarla**

Nella firma del componente (riga ~71):
```ts
export default function WealthDistributionChart({
  mode,
  assetData,
  accountData,
  title = 'Distribuzione Patrimonio', // <-- aggiungere con default
}: WealthDistributionChartProps) {
```

Nelle due occorrenze dell'`<h3>` (empty state + chart state), sostituire il testo fisso con `{title}`.

**Step 3: Typecheck**
```bash
npm run typecheck
```
Expected: no errors (è una prop opzionale con default, nessun caller deve cambiare).

**Step 4: Commit**
```bash
git add src/components/WealthDistributionChart.tsx
git commit -m "feat: add optional title prop to WealthDistributionChart"
```

---

### Task 2: Creare `PortfolioTrendChart.tsx`

**Files:**
- Create: `src/components/PortfolioTrendChart.tsx`

**Step 1: Creare il file**

```tsx
'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────

interface PortfolioTrendChartProps {
  userId: string;
  savingsTotal: number;
  investmentsTotal: number; // market value oppure cost basis (calcolato nel parent)
}

interface ChartDataPoint {
  label: string;
  savings: number;
  investments: number;
}

// ── Constants ────────────────────────────────────────────────────────

const MONTH_ABBREVIATIONS = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];

const SAVINGS_COLOR = '#38BDF8';
const INVESTMENTS_COLOR = '#A78BFA';

// ── Tooltip ──────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function formatEur(value: number): string {
  return value.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-warmBg-tertiary border border-warmText-muted rounded-2xl px-4 py-3 shadow-xl min-w-[180px]">
      <p className="text-xs font-medium text-warmText-secondary mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-warmText-tertiary">{entry.name}</span>
          <span className="text-xs font-semibold text-warmText-primary ml-auto pl-3 tabular-nums">
            {formatEur(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

export default function PortfolioTrendChart({
  userId,
  savingsTotal,
  investmentsTotal,
}: PortfolioTrendChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data, error } = await supabase
        .from('wealth_snapshots')
        .select('year, month, savings_balance, investments_balance')
        .eq('user_id', userId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (error || !data || data.length === 0) {
        // Still show "Oggi" as a single point so the chart is never empty
        setChartData([{ label: 'Oggi', savings: savingsTotal, investments: investmentsTotal }]);
        setLoading(false);
        return;
      }

      const points: ChartDataPoint[] = data.map((s) => ({
        label: `${MONTH_ABBREVIATIONS[s.month - 1]} ${String(s.year).slice(2)}`,
        savings: Math.round(Number(s.savings_balance) * 100) / 100,
        investments: Math.round(Number(s.investments_balance) * 100) / 100,
      }));

      // Add live "Oggi" point
      points.push({
        label: 'Oggi',
        savings: Math.round(savingsTotal * 100) / 100,
        investments: Math.round(investmentsTotal * 100) / 100,
      });

      setChartData(points);
      setLoading(false);
    }

    fetchData();
  }, [userId, savingsTotal, investmentsTotal]);

  if (loading) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-5 mb-4 animate-cardEnter">
        <ChartHeader />
        <div className="h-[200px] rounded-2xl bg-warmBg-tertiary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-5 mb-4 animate-cardEnter">
      <ChartHeader />
      <div className="h-[200px] sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
          >
            <defs>
              <linearGradient id="gradTrendSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SAVINGS_COLOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={SAVINGS_COLOR} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradTrendInvestments" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INVESTMENTS_COLOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={INVESTMENTS_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke="#1A1E26" vertical={false} />

            <XAxis
              dataKey="label"
              stroke="#5A6474"
              tick={{ fontSize: 10, fill: '#5A6474' }}
              tickLine={false}
              axisLine={{ stroke: '#1A1E26' }}
              dy={8}
            />
            <YAxis
              stroke="#5A6474"
              tick={{ fontSize: 10, fill: '#5A6474' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 0 })}k`
              }
              width={44}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#5A6474', strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
              formatter={(value: string) => (
                <span style={{ color: '#8B95A5', fontSize: '11px', marginLeft: '3px' }}>
                  {value}
                </span>
              )}
            />

            <Area
              type="monotone"
              dataKey="savings"
              name="Risparmi"
              stroke={SAVINGS_COLOR}
              fill="url(#gradTrendSavings)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: SAVINGS_COLOR, stroke: '#12151A', strokeWidth: 2 }}
              animationDuration={1000}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="investments"
              name="Investimenti"
              stroke={INVESTMENTS_COLOR}
              fill="url(#gradTrendInvestments)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: INVESTMENTS_COLOR, stroke: '#12151A', strokeWidth: 2 }}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartHeader() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex gap-0.5">
        <div className="w-1 h-5 rounded-full bg-warmData-savings" />
        <div className="w-1 h-5 rounded-full bg-warmData-investment" />
      </div>
      <h3 className="text-base font-semibold text-warmText-primary">
        Andamento Patrimonio
      </h3>
    </div>
  );
}
```

**Step 2: Typecheck**
```bash
npm run typecheck
```
Expected: no errors.

**Step 3: Commit**
```bash
git add src/components/PortfolioTrendChart.tsx
git commit -m "feat: add PortfolioTrendChart with savings/investments trend"
```

---

### Task 3: Modificare `NetWorthCard` — donut integrato (Approach A)

**Files:**
- Modify: `src/components/NetWorthCard.tsx`

**Step 1: Aggiungere import e props**

In cima al file, aggiungere import:
```ts
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import type { AccountSlice } from '@/components/WealthDistributionChart';
```

Aggiornare l'interfaccia props:
```ts
interface NetWorthCardProps {
  savingsTotal: number;
  totalCashBalance: number;
  totalMarketValue: number | null;
  totalCostBasis: number;
  pricesLoading: boolean;
  accountSlices: AccountSlice[]; // <-- nuovo
}
```

**Step 2: Distruttare la nuova prop**

```ts
export default function NetWorthCard({
  savingsTotal,
  totalCashBalance,
  totalMarketValue,
  totalCostBasis,
  pricesLoading,
  accountSlices, // <-- aggiungere
}: NetWorthCardProps) {
```

**Step 3: Costanti colori (module scope, fuori dal componente)**

```ts
const DONUT_COLORS = [
  '#38BDF8', '#A78BFA', '#34D399', '#F59E0B',
  '#F472B6', '#2DD4BF', '#FB923C', '#818CF8',
];
```

**Step 4: Tooltip donut (funzione a module scope)**

```tsx
interface DonutTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { name: string; value: number } }>;
}

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const formatted = entry.value.toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
  return (
    <div className="bg-warmBg-tertiary border border-warmText-muted rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-warmText-primary mb-0.5">{entry.payload.name}</p>
      <p className="text-sm font-bold text-warmText-primary">{formatted}</p>
    </div>
  );
}
```

**Step 5: Aggiornare il JSX del componente**

Il card esistente (`<div className="bg-warmBg-secondary rounded-2xl p-5 mb-6">`) diventa un layout flex:

```tsx
return (
  <div className="bg-warmBg-secondary rounded-2xl p-5 mb-4">
    <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-center">

      {/* ── LEFT: existing summary ─────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Total Net Worth */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-warmAccent-primary bg-opacity-10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-warmAccent-primary" />
          </div>
          <p className="text-xs font-medium text-warmText-tertiary uppercase tracking-wider">
            Patrimonio Netto
          </p>
        </div>
        <p className="text-3xl font-bold text-warmText-primary ml-10 mb-4">
          <CountUp end={total} />
        </p>

        {/* Proportional Bar */}
        {total > 0 && (
          <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
            {liquidityPct > 0 && (
              <div
                className="bg-warmData-savings transition-all duration-500"
                style={{ width: `${liquidityPct}%` }}
              />
            )}
            {investmentsPct > 0 && (
              <div
                className="bg-warmData-investment transition-all duration-500"
                style={{ width: `${investmentsPct}%` }}
              />
            )}
          </div>
        )}

        {/* Breakdown Rows */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-warmData-savings bg-opacity-10 flex items-center justify-center">
                <Droplets className="w-3.5 h-3.5 text-warmData-savings" />
              </div>
              <div>
                <p className="text-sm font-medium text-warmText-primary">Liquidita</p>
                <p className="text-xs text-warmText-tertiary">{liquidityPct}%</p>
              </div>
            </div>
            <p className="text-sm font-bold text-warmText-primary">{formatCurrency(liquidity)}</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-warmData-investment bg-opacity-10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-warmData-investment" />
              </div>
              <div>
                <p className="text-sm font-medium text-warmText-primary">
                  Investimenti
                  {isEstimate && !pricesLoading && (
                    <span className="text-xs text-warmText-tertiary ml-1">(stima)</span>
                  )}
                  {pricesLoading && (
                    <span className="text-xs text-warmText-tertiary ml-1 animate-pulse">...</span>
                  )}
                </p>
                <p className="text-xs text-warmText-tertiary">{investmentsPct}%</p>
              </div>
            </div>
            <p className="text-sm font-bold text-warmText-primary">{formatCurrency(investments)}</p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: donut chart (solo se ci sono dati) ─ */}
      {accountSlices.length > 0 && (
        <div className="mt-5 lg:mt-0 lg:w-44 lg:flex-shrink-0">
          {/* Separatore mobile */}
          <div className="lg:hidden border-t border-warmBg-tertiary mb-4" />
          <p className="text-xs font-medium text-warmText-tertiary text-center mb-2">Per conto</p>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie
                data={accountSlices}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
                animationDuration={800}
                animationEasing="ease-out"
              >
                {accountSlices.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                    stroke="#0B0D11"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <RechartsTooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Mini legend */}
          <div className="mt-1 space-y-1 max-h-[80px] overflow-y-auto">
            {accountSlices.map((slice, index) => (
              <div key={slice.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                />
                <span className="text-warmText-tertiary truncate flex-1">{slice.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  </div>
);
```

**Step 6: Typecheck**
```bash
npm run typecheck
```
Expected: no errors.

**Step 7: Commit**
```bash
git add src/components/NetWorthCard.tsx
git commit -m "feat: add account donut chart to NetWorthCard"
```

---

### Task 4: Aggiornare `patrimonio/page.tsx`

**Files:**
- Modify: `src/app/dashboard/patrimonio/page.tsx`

**Step 1: Aggiungere import**

Nella sezione import dynamic:
```tsx
const PortfolioTrendChart = dynamic(() => import('@/components/PortfolioTrendChart'), { ssr: false });
```

**Step 2: Passare `accountSlices` a `NetWorthCard`**

Trovare `<NetWorthCard` (riga ~246) e aggiungere la prop:
```tsx
<NetWorthCard
  savingsTotal={savingsTotal}
  totalCashBalance={totalCashBalance}
  totalMarketValue={totalMarketValue}
  totalCostBasis={totalCostBasis}
  pricesLoading={pricesLoading}
  accountSlices={accountSlices}   {/* <-- aggiungere */}
/>
```

**Step 3: Aggiungere `PortfolioTrendChart` tra NetWorthCard e la griglia**

Dopo il blocco `{!isLoading && (<NetWorthCard ... />)}` e prima di `<div className="lg:grid lg:grid-cols-5 lg:gap-6">`, aggiungere:

```tsx
{/* Portfolio Trend Chart - full width */}
{!isLoading && (
  <PortfolioTrendChart
    userId={user.id}
    savingsTotal={savingsTotal}
    investmentsTotal={totalMarketValue ?? totalCostBasis}
  />
)}
```

**Step 4: Riorganizzare la RIGHT COLUMN**

Attualmente la RIGHT COLUMN (`lg:col-span-2`) ha questa struttura:
```tsx
{activeTab === 'risparmi' ? (
  <SavingsPerformanceChart ... />
) : (
  <> Controvalore + InvestmentPerformanceChart </>
)}
{/* WealthDistributionChart - sempre visibile */}
<div className="hidden lg:block"> ... </div>
```

Sostituire con:
```tsx
{activeTab === 'risparmi' ? (
  <>
    <SavingsPerformanceChart userId={user.id} currentTotal={savingsTotal} accounts={savingsAccountsData} />
    {/* Savings-only distribution pie */}
    {savingsAccountsData.length > 1 && (
      <WealthDistributionChart
        mode="per-conto"
        assetData={[]}
        accountData={savingsAccountsData.map(a => ({ name: a.name, value: a.balance }))}
        title="Distribuzione Risparmi"
      />
    )}
  </>
) : (
  <>
    {/* Controvalore Card - invariato */}
    {totalMarketValue !== null && (
      <div className="bg-warmBg-secondary rounded-2xl p-4 border border-warmData-investment border-opacity-20">
        {/* ... codice invariato ... */}
      </div>
    )}
    <InvestmentPerformanceChart
      userId={user.id}
      totalMarketValue={totalMarketValue}
      totalCashBalance={totalCashBalance}
      accounts={investAccounts}
    />
    {/* WealthDistributionChart con toggle - solo tab investimenti */}
    {(assetSlices.length > 0 || accountSlices.length > 0) && (
      <>
        <div className="bg-warmBg-tertiary rounded-lg p-0.5 flex">
          <button
            onClick={() => setDistributionMode('per-asset')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-300 ${
              distributionMode === 'per-asset'
                ? 'bg-warmAccent-primary text-white shadow-sm'
                : 'text-warmText-tertiary hover:text-warmText-secondary'
            }`}
          >
            Per Asset
          </button>
          <button
            onClick={() => setDistributionMode('per-conto')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-300 ${
              distributionMode === 'per-conto'
                ? 'bg-warmAccent-primary text-white shadow-sm'
                : 'text-warmText-tertiary hover:text-warmText-secondary'
            }`}
          >
            Per Conto
          </button>
        </div>
        <div key={`dist-${distributionMode}`} className="animate-fadeSlideIn">
          <WealthDistributionChart
            mode={distributionMode}
            assetData={assetSlices}
            accountData={accountSlices}
          />
        </div>
      </>
    )}
  </>
)}
```

**Step 5: Rimuovere il blocco mobile WealthDistributionChart**

Trovare e **eliminare** il blocco (riga ~370-403):
```tsx
{/* Distribution Chart - mobile only (between performance chart and accounts list) */}
{(assetSlices.length > 0 || accountSlices.length > 0) && (
  <div className="lg:hidden mb-4">
    ...WealthDistributionChart mobile...
  </div>
)}
```
Questo blocco è ora superfluo: il donut è nel NetWorthCard (sempre visibile), e le pie per tab sono nella sidebar.

**Step 6: Typecheck**
```bash
npm run typecheck
```
Expected: no errors.

**Step 7: Commit**
```bash
git add src/app/dashboard/patrimonio/page.tsx
git commit -m "feat: wire PortfolioTrendChart, donut in NetWorthCard, savings-only pie"
```

---

### Task 5: Verifica visiva

**Checklist:**
- [ ] NetWorthCard: su desktop mostra barre a sinistra + donut a destra. Su mobile: barre in alto, poi separatore, poi donut compatto
- [ ] PortfolioTrendChart: visibile full-width sotto il NetWorthCard, mostra due aree (savings blu, investments viola)
- [ ] Tab Risparmi → sidebar: `SavingsPerformanceChart` (area per-account) + sotto, se ci sono >1 account, pie "Distribuzione Risparmi" con solo savings accounts
- [ ] Tab Investimenti → sidebar: `Controvalore card` + `InvestmentPerformanceChart` + toggle per-asset/per-conto con `WealthDistributionChart`
- [ ] Su mobile: layout corretto, nessun overflow orizzontale, touch targets ≥ 44px

**Step 1: Avviare dev server**
```bash
npm run dev
```

**Step 2: Aprire** `http://localhost:3000/dashboard/patrimonio` e verificare tutti i punti della checklist.

**Step 3: Verifica mobile** — aprire DevTools → toggle device toolbar → iPhone 14 Pro (390px). Verificare layout stacked e assenza overflow.

---

### Task 6: Typecheck + test finale

```bash
npm run typecheck && npm test
```
Expected: typecheck clean, test suite green.

**Commit finale (se non già fatto):**
```bash
git add -A
git commit -m "feat: patrimonio charts - donut in NetWorthCard, PortfolioTrendChart, savings pie"
```
