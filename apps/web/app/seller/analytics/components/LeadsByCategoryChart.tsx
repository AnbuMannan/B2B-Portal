'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CategoryEntry {
  category: string;
  count: number;
}

interface LeadsByCategoryChartProps {
  data: CategoryEntry[];
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16',
];

export function LeadsByCategoryChart({ data }: LeadsByCategoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No enquiry data for this period.
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          formatter={(value) => {
            const n = Number(value);
            return [`${n} (${Math.round((n / total) * 100)}%)`, 'Leads'];
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: '#6b7280' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
