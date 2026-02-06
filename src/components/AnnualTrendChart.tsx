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
    <div className="bg-warmBg-secondary rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-warmText-primary mb-4">
        Andamento Annuale
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px'
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
            stroke="#10b981"
            strokeWidth={2}
            name="Entrate"
            dot={{ fill: '#10b981', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#ef4444"
            strokeWidth={2}
            name="Spese"
            dot={{ fill: '#ef4444', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="investments"
            stroke="#8b5cf6"
            strokeWidth={2}
            name="Investimenti"
            dot={{ fill: '#8b5cf6', r: 3 }}
            activeDot={{ r: 5 }}
          />
          {monthlyInvestments && (
            <Line
              type="monotone"
              dataKey="wealthInvestments"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Investimenti Accumulati"
              dot={{ fill: '#8b5cf6', r: 2 }}
              activeDot={{ r: 4 }}
            />
          )}
          {monthlySavings && (
            <Line
              type="monotone"
              dataKey="wealthSavings"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Risparmi Accumulati"
              dot={{ fill: '#3b82f6', r: 2 }}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
