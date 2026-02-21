'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ExpenseTransaction {
  amount: number;
  start_date: string;
  category_name?: string;
}

interface MonthlyRecapChartProps {
  expenses: ExpenseTransaction[];
  year: number;
  month: number;
}

// Distinct colors for expense categories
const CATEGORY_COLORS: Record<string, string> = {
  'Affitto': '#ef4444',
  'Bollette': '#f97316',
  'Spesa': '#f59e0b',
  'Trasporti': '#84cc16',
  'Svago': '#06b6d4',
  'Salute': '#8b5cf6',
  'Abbigliamento': '#ec4899',
  'Ristoranti': '#14b8a6',
  'Abbonamenti': '#6366f1',
  'Istruzione': '#a855f7',
};

const FALLBACK_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
  '#22d3ee', '#818cf8', '#c084fc', '#f472b6', '#94a3b8',
];

function getCategoryColor(name: string, index: number): string {
  return CATEGORY_COLORS[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function MonthlyRecapChart({
  expenses,
  year,
  month,
}: MonthlyRecapChartProps) {
  const { chartData, categories } = useMemo(() => {
    if (expenses.length === 0) return { chartData: [], categories: [] };

    // Get days in month
    const daysInMonth = new Date(year, month, 0).getDate();

    // Collect all categories and group amounts by day + category
    const categorySet = new Set<string>();
    const dayMap = new Map<number, Record<string, number>>();

    for (const tx of expenses) {
      const cat = tx.category_name || 'Altro';
      categorySet.add(cat);
      const day = new Date(tx.start_date).getDate();
      if (!dayMap.has(day)) dayMap.set(day, {});
      const record = dayMap.get(day)!;
      record[cat] = (record[cat] || 0) + tx.amount;
    }

    // Sort categories by total amount (largest first for stacking order)
    const catTotals = new Map<string, number>();
    for (const [, record] of dayMap) {
      for (const [cat, amt] of Object.entries(record)) {
        catTotals.set(cat, (catTotals.get(cat) || 0) + amt);
      }
    }
    const sortedCategories = Array.from(categorySet).sort(
      (a, b) => (catTotals.get(b) || 0) - (catTotals.get(a) || 0)
    );

    // Build chart data: one entry per day
    const data = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const entry: Record<string, number | string> = { day: d.toString() };
      const record = dayMap.get(d);
      if (record) {
        for (const cat of sortedCategories) {
          entry[cat] = Math.round((record[cat] || 0) * 100) / 100;
        }
      }
      data.push(entry);
    }

    return { chartData: data, categories: sortedCategories };
  }, [expenses, year, month]);

  if (expenses.length === 0) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-4">
        <h3 className="text-sm font-medium text-warmText-tertiary mb-3">Spese Giornaliere</h3>
        <div className="flex items-center justify-center h-[160px] text-sm text-warmText-disabled">
          Nessuna spesa
        </div>
      </div>
    );
  }

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-4">
      <h3 className="text-sm font-medium text-warmText-tertiary mb-3">Spese Giornaliere</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: '#5A6474' }}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: '#5A6474' }}
            tickFormatter={(v: number) => v > 0 ? `${v}` : ''}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1E26',
              border: '1px solid #2A3040',
              borderRadius: '8px',
              fontSize: '11px',
            }}
            labelStyle={{ color: '#8B95A5', marginBottom: 4 }}
            labelFormatter={(label: string) => `Giorno ${label}`}
            formatter={(value: number, name: string) => [
              `€${value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              name,
            ]}
            itemSorter={(item: any) => -(item.value || 0)}
          />
          <Legend
            wrapperStyle={{ fontSize: '10px', paddingTop: 4 }}
            iconSize={8}
          />
          {categories.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="expenses"
              fill={getCategoryColor(cat, i)}
              radius={i === 0 ? [2, 2, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
