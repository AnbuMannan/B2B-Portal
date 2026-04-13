'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ViewsTrendChart } from './components/ViewsTrendChart';
import { TopProductsChart } from './components/TopProductsChart';
import { LeadsByCategoryChart } from './components/LeadsByCategoryChart';
import { IndiaHeatmap } from './components/IndiaHeatmap';
import { CreditUsageCard } from './components/CreditUsageCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type Period = '7d' | '30d' | '90d';

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

interface AnalyticsData {
  period: Period;
  generatedAt: string;
  fromCache?: boolean;
  engagementTrend: { date: string; reveals: number }[];
  productViews: { total: number };
  leadsViewed: { total: number; converted: number; conversionRate: number };
  allTimeConversion: { totalReveals: number; converted: number; conversionRate: number };
  topProducts: { productId: string; name: string; views: number }[];
  enquiriesByCategory: { category: string; count: number }[];
  buyerGeography: { country: string; count: number }[];
  creditUsage: {
    spent30d: number;
    purchased30d: number;
    currentBalance: number;
    dailyBurnRate: number;
    daysToDepletion: number | null;
    depletionDate: string | null;
    criticalAlert: boolean;
  };
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'green' | 'purple' | 'amber';
}

function KpiCard({ label, value, sub, accent = 'blue' }: KpiCardProps) {
  const accents = {
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <div className={`rounded-xl border px-5 py-4 ${accents[accent]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-xl bg-gray-200" />;
}

function SkeletonChart() {
  return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
}

export default function SellerAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchAnalytics = useCallback(async (p: Period) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/seller/analytics?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to load analytics');
      setData(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(period);
  }, [period, fetchAnalytics]);

  const handleExport = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setIsExporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/seller/analytics/export?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          {data?.fromCache && (
            <p className="text-xs text-gray-400 mt-0.5">Cached data · refreshes hourly</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExport}
            disabled={isExporting || isLoading || !data}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Product Views"
            value={data.productViews.total.toLocaleString()}
            sub="All-time aggregate"
            accent="blue"
          />
          <KpiCard
            label="Leads Revealed"
            value={data.leadsViewed.total.toLocaleString()}
            sub={`This ${period.replace('d', '-day')} period`}
            accent="purple"
          />
          <KpiCard
            label="Conversion Rate"
            value={`${data.leadsViewed.conversionRate}%`}
            sub={`${data.leadsViewed.converted} converted (period)`}
            accent="green"
          />
          <KpiCard
            label="All-Time Conversions"
            value={data.allTimeConversion.converted.toLocaleString()}
            sub={`${data.allTimeConversion.conversionRate}% of all reveals`}
            accent="amber"
          />
        </div>
      ) : null}

      {/* ── Row 1: Engagement trend + Credit usage ────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><SkeletonChart /></div>
          <SkeletonChart />
        </div>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Lead Reveal Trend (daily)">
            <ViewsTrendChart data={data.engagementTrend} />
          </ChartCard>
          <CreditUsageCard data={data.creditUsage} />
        </div>
      ) : null}

      {/* ── Row 2: Top products + Leads by category ───────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Top Products by Views">
            <TopProductsChart data={data.topProducts} />
          </ChartCard>
          <ChartCard title="Enquiries by Category">
            <LeadsByCategoryChart data={data.enquiriesByCategory} />
          </ChartCard>
        </div>
      ) : null}

      {/* ── Row 3: Buyer geography ────────────────────────────────────────── */}
      {isLoading ? (
        <SkeletonChart />
      ) : data ? (
        <ChartCard title="Buyer Geography (by revealed leads)">
          <IndiaHeatmap data={data.buyerGeography} />
        </ChartCard>
      ) : null}
    </div>
  );
}
