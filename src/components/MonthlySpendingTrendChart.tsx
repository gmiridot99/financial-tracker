'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

interface MonthlySpendingTrendChartProps {
  userId: string;
  currentYear: number;
  currentMonth: number;
}

interface MonthData {
  label: string;
  expenses: number;
  isCurrent: boolean;
}

export default function MonthlySpendingTrendChart({
  userId,
  currentYear,
  currentMonth,
}: MonthlySpendingTrendChartProps) {
  const [data, setData] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const currentDate = new Date(currentYear, currentMonth - 1, 1);
        const months: { year: number; month: number; label: string }[] = [];

        for (let i = 5; i >= 0; i--) {
          const d = subMonths(currentDate, i);
          months.push({
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            label: format(d, 'MMM', { locale: it }),
          });
        }

        // Single query: fetch all expense transactions for the 6-month range
        const startDate = `${months[0].year}-${String(months[0].month).padStart(2, '0')}-01`;
        const lastMonth = months[months.length - 1];
        const lastMonthDate = new Date(lastMonth.year, lastMonth.month, 0); // last day of month
        const endDate = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-${String(lastMonthDate.getDate()).padStart(2, '0')}`;

        const { data: txData, error } = await supabase
          .from('transactions')
          .select('amount, start_date, category, categories(name)')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .gte('start_date', startDate)
          .lte('start_date', endDate);

        if (error) throw error;

        // Group by month
        const monthTotals = new Map<string, number>();
        for (const tx of txData || []) {
          const txDate = new Date(tx.start_date);
          const key = `${txDate.getFullYear()}-${txDate.getMonth() + 1}`;
          // Exclude investments (they are categorized as expenses but are actually investments)
          const categoryName = (tx as any).categories?.name;
          if (categoryName === 'Investimenti') continue;
          monthTotals.set(key, (monthTotals.get(key) || 0) + tx.amount);
        }

        const chartData: MonthData[] = months.map((m, idx) => ({
          label: m.label.charAt(0).toUpperCase() + m.label.slice(1),
          expenses: Math.round((monthTotals.get(`${m.year}-${m.month}`) || 0) * 100) / 100,
          isCurrent: idx === months.length - 1,
        }));

        setData(chartData);
      } catch (error) {
        console.error('Error fetching spending trend:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId, currentYear, currentMonth]);

  if (isLoading) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-4">
        <h3 className="text-sm font-medium text-warmText-tertiary mb-3">Andamento Spese</h3>
        <div className="animate-pulse bg-warmBg-tertiary rounded-xl h-[160px]" />
      </div>
    );
  }

  const hasData = data.some(d => d.expenses > 0);

  if (!hasData) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-4">
        <h3 className="text-sm font-medium text-warmText-tertiary mb-3">Andamento Spese</h3>
        <div className="flex items-center justify-center h-[160px] text-sm text-warmText-disabled">
          Nessun dato disponibile
        </div>
      </div>
    );
  }

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-4">
      <h3 className="text-sm font-medium text-warmText-tertiary mb-3">Andamento Spese</h3>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
          <defs>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F87171" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#5A6474' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1E26',
              border: '1px solid #2A3040',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#8B95A5' }}
            formatter={(value: number) => [
              `€${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              'Spese',
            ]}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke="#F87171"
            strokeWidth={2}
            fill="url(#expenseGradient)"
            dot={(props: any) => {
              const { cx, cy, index } = props;
              const r = index === data.length - 1 ? 5 : 3;
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="#F87171"
                  stroke="#12151A"
                  strokeWidth={2}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
