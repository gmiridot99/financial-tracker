'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export interface MonthlyData {
  month: string; // "Gen", "Feb", etc.
  income: number;
  expenses: number;
  investments: number;
}

interface AnnualTrendChartProps {
  data: MonthlyData[];
  monthlyInvestments?: number[];
  monthlySavings?: number[];
}

export default function AnnualTrendChart({ data, monthlyInvestments, monthlySavings }: AnnualTrendChartProps) {
  // Merge wealth data into chart data if provided
  const chartData = data.map((d, index) => ({
    ...d,
    wealthInvestments: monthlyInvestments?.[index] || 0,
    wealthSavings: monthlySavings?.[index] || 0,
  }));
  return (
    <div className="bg-warmBg-secondary rounded-2xl p-4 md:p-6">
      <h3 className="text-lg font-semibold text-warmText-primary mb-4">
        Andamento Annuale
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1A1E26" />
          <XAxis
            dataKey="month"
            stroke="#5A6474"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#5A6474"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1E26',
              border: '1px solid #232830',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#F0F2F5'
            }}
            formatter={(value: number) => `€${value.toFixed(2)}`}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#34D399"
            strokeWidth={2}
            name="Entrate"
            dot={{ fill: '#34D399', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#F87171"
            strokeWidth={2}
            name="Spese"
            dot={{ fill: '#F87171', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="investments"
            stroke="#A78BFA"
            strokeWidth={2}
            name="Investimenti"
            dot={{ fill: '#A78BFA', r: 3 }}
            activeDot={{ r: 5 }}
          />
          {monthlyInvestments && (
            <Line
              type="monotone"
              dataKey="wealthInvestments"
              stroke="#A78BFA"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Investimenti Accumulati"
              dot={{ fill: '#A78BFA', r: 2 }}
              activeDot={{ r: 4 }}
            />
          )}
          {monthlySavings && (
            <Line
              type="monotone"
              dataKey="wealthSavings"
              stroke="#38BDF8"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Risparmi Accumulati"
              dot={{ fill: '#38BDF8', r: 2 }}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
