# Design: Patrimonio Charts Enhancement

**Date:** 2026-02-21
**Status:** Approved

## Scope

Three visual additions to `src/app/dashboard/patrimonio/page.tsx`:

1. **Donut chart** showing full-portfolio distribution (per-conto) integrated into `NetWorthCard`
2. **PortfolioTrendChart** — full-width stacked area chart (risparmi vs investimenti mese su mese), placed between NetWorthCard and tabs
3. **Savings-only pie** in the Risparmi tab sidebar (replace existing all-accounts `WealthDistributionChart`)

---

## 1. NetWorthCard — integrated donut (Approach A)

### Layout
- **Desktop** (`lg+`): flex-row split — left 55% = existing bars + breakdown, right 45% = donut chart
- **Mobile**: stacked — existing content on top, compact donut below (height ~160px)

### Donut data
- Uses `accountSlices: AccountSlice[]` (new prop from parent page)
- `accountSlices` = all savings accounts + all investment accounts per-conto (already computed in page)
- Donut: `innerRadius=45 outerRadius=70`, padding angle 2, animated
- Tooltip: same style as `WealthDistributionChart`
- No legend inside the card (already shown in breakdown rows on the left)

### Props change
```ts
interface NetWorthCardProps {
  // existing
  savingsTotal: number;
  totalCashBalance: number;
  totalMarketValue: number | null;
  totalCostBasis: number;
  pricesLoading: boolean;
  // new
  accountSlices: AccountSlice[];  // imported from WealthDistributionChart types
}
```

---

## 2. PortfolioTrendChart — new component

### File
`src/components/PortfolioTrendChart.tsx`

### Data source
`wealth_snapshots` table: `year`, `month`, `savings_balance`, `investments_balance`
+ synthetic "Oggi" data point using live `savingsTotal` + `investmentsTotal` (market value or cost basis)

### Chart type
`AreaChart` (Recharts) with two `Area` series:
- `savings` → `warmData-savings` (#38BDF8, blue) with gradient fill
- `investments` → `warmData-investment` (#A78BFA, purple) with gradient fill

### Props
```ts
interface PortfolioTrendChartProps {
  userId: string;
  savingsTotal: number;        // current live savings
  investmentsTotal: number;    // current live investments (market value or cost basis)
}
```

### Layout in page
- Full-width card, placed between `NetWorthCard` and the tab bar
- Height: `h-[220px]` mobile, `h-[240px]` desktop
- Title: "Andamento Patrimonio" with dual color accent bars (blue + purple)

---

## 3. Savings tab — savings-only pie chart

### What changes
- **Remove**: `WealthDistributionChart` (per-asset/per-conto toggle) from the savings tab sidebar in both desktop and mobile views. This view is now redundant with the top donut showing all accounts.
- **Add**: Inside `SavingsPerformanceChart`, a savings-only pie chart below the area chart.
  - Props extended: `accounts: { id: string; name: string; balance: number }[]`
  - Pie chart rendered at bottom of the same card (below area chart)
  - Shows only savings accounts, mode forced to `per-conto`
  - Uses same `SLICE_COLORS` as `WealthDistributionChart`
  - Title: "Distribuzione Risparmi" with legend

### WealthDistributionChart in investments tab
- **Keep as-is** in the investments tab sidebar (per-asset/per-conto toggle stays, shows all assets + all accounts)

---

## Files affected

| File | Change |
|------|--------|
| `src/components/NetWorthCard.tsx` | Add `accountSlices` prop + donut layout |
| `src/components/PortfolioTrendChart.tsx` | **New** — stacked area chart |
| `src/components/SavingsPerformanceChart.tsx` | Add `accounts` prop + savings-only pie at bottom |
| `src/app/dashboard/patrimonio/page.tsx` | Wire new props; add PortfolioTrendChart; remove WealthDistributionChart from savings tab |

---

## Responsive behavior

| Element | Mobile | Desktop |
|---------|--------|---------|
| NetWorthCard donut | Below bars, compact (160px) | Right side of card (flex-row) |
| PortfolioTrendChart | Full-width, 220px | Full-width, 240px |
| Savings pie (in SavingsPerformanceChart) | Full-width below area chart | Full-width below area chart (sidebar) |
| WealthDistributionChart | Investments tab only | Investments tab only |

---

## Design system tokens used
- Colors: `warmData-savings`, `warmData-investment`, `warmBg-secondary`, `warmText-primary/secondary/tertiary`
- Card style: `bg-warmBg-secondary rounded-2xl p-5`
- Animation: `animationDuration={800} animationEasing="ease-out"` (Recharts)
- Gradient: same pattern as `SavingsPerformanceChart` (`linearGradient` with opacity falloff)
