'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TopProduct {
  productId: string;
  name: string;
  views: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
}

const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

export function TopProductsChart({ data }: TopProductsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No product view data yet.
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    shortName: d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={formatted}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          tick={{ fontSize: 11, fill: '#374151' }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          formatter={(value) => [Number(value), 'Views']}
          labelFormatter={(label) => {
            const item = data.find((d) => d.name.startsWith(label.replace('…', '')));
            return item?.name ?? label;
          }}
        />
        <Bar dataKey="views" radius={[0, 4, 4, 0]}>
          {formatted.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
