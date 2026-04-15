'use client';

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

interface GeoEntry {
  country: string;
  count: number;
}

interface IndiaHeatmapProps {
  data: GeoEntry[];
}

const COLORS = [
  '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
  '#bfdbfe', '#dbeafe', '#eff6ff',
];

interface ContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  rank?: number;
}

function CustomContent({ x = 0, y = 0, width = 0, height = 0, name = '', value = 0, rank = 0 }: ContentProps) {
  const color = COLORS[Math.min(rank, COLORS.length - 1)];
  const textColor = rank < 4 ? '#ffffff' : '#1e3a8a';
  const showLabel = width > 50 && height > 30;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={4} stroke="#fff" strokeWidth={2} />
      {showLabel && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill={textColor} fontSize={11} fontWeight={600}>
            {name.length > 14 ? name.slice(0, 12) + '…' : name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill={textColor} fontSize={10} opacity={0.85}>
            {value}
          </text>
        </>
      )}
    </g>
  );
}

export function IndiaHeatmap({ data }: IndiaHeatmapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No buyer geography data yet.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const treemapData = sorted.map((d, i) => ({
    name: d.country,
    size: d.count,
    rank: i,
    value: d.count,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <Treemap
          data={treemapData}
          dataKey="size"
          content={<CustomContent />}
        >
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={(value, _name, props: { payload?: { name?: string } }) => [Number(value), props?.payload?.name ?? 'Country']}
            labelFormatter={() => ''}
          />
        </Treemap>
      </ResponsiveContainer>
      {/* Top-5 legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {sorted.slice(0, 5).map((d, i) => (
          <span
            key={d.country}
            className="inline-flex items-center gap-1.5 text-xs text-gray-600"
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[Math.min(i, COLORS.length - 1)] }}
            />
            {d.country} ({d.count})
          </span>
        ))}
      </div>
    </div>
  );
}
