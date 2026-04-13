'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TrendPoint {
  date: string;
  reveals: number;
}

interface ViewsTrendChartProps {
  data: TrendPoint[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function ViewsTrendChart({ data }: ViewsTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No engagement data for this period.
      </div>
    );
  }

  const formatted = data.map((d) => ({ ...d, label: formatDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          labelStyle={{ color: '#374151', fontWeight: 600 }}
          formatter={(value) => [Number(value), 'Leads Revealed']}
        />
        <Line
          type="monotone"
          dataKey="reveals"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
