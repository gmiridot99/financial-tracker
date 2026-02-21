'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export interface CategoryData {
  name: string;
  value: number;
}

interface CategoryBreakdownChartProps {
  data: CategoryData[];
}

// Color palette for expense categories (shades of red/orange)
const COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#9ca3af', // gray-400 for "Altro"
];

export default function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-warmBg-secondary rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-warmText-primary mb-4">
          Spese per Categoria
        </h3>
        <div className="text-center py-8 text-warmText-tertiary text-sm">
          Nessuna spesa registrata
        </div>
      </div>
    );
  }

  // Sort by value descending and take top 5
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const top5 = sortedData.slice(0, 5);
  const rest = sortedData.slice(5);

  // Group remaining categories as "Altro"
  const chartData = [...top5];
  if (rest.length > 0) {
    const altroValue = rest.reduce((sum, cat) => sum + cat.value, 0);
    chartData.push({ name: 'Altro', value: altroValue });
  }

  const total = chartData.reduce((sum, cat) => sum + cat.value, 0);

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-4 md:p-6">
      <h3 className="text-lg font-semibold text-warmText-primary mb-4">
        Spese per Categoria
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={85}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
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
            formatter={(value: string) => {
              const entry = chartData.find(d => d.name === value);
              const percent = entry ? ((entry.value / total) * 100).toFixed(0) : '0';
              return `${value} (${percent}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
