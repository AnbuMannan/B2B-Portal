'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface DashboardStats {
  totalUsers: number;
  totalSellers: number;
  totalBuyers: number;
  totalProducts: number;
  pendingKyc: number;
  pendingProducts: number;
  openComplaints: number;
  totalOrders: number;
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  ipAddress: string | null;
  user: { email: string } | null;
}

const STAT_CARDS = (stats: DashboardStats) => [
  {
    label: 'Total Users',
    value: stats.totalUsers,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: 'Sellers',
    value: stats.totalSellers,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Buyers',
    value: stats.totalBuyers,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    label: 'Products',
    value: stats.totalProducts,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-500/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
      </svg>
    ),
  },
  {
    label: 'Pending KYC',
    value: stats.pendingKyc,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-500/10',
    badge: stats.pendingKyc > 0,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'Pending Products',
    value: stats.pendingProducts,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    badge: stats.pendingProducts > 0,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Open Complaints',
    value: stats.openComplaints,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-500/10',
    badge: stats.openComplaints > 0,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    label: 'Total Orders',
    value: stats.totalOrders,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      const token = localStorage.getItem('adminAccessToken');
      if (!token) {
        router.push('/admin/login');
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/api/admin/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const { stats: s, recentActivity } = res.data.data;
        setStats(s);
        setActivity(recentActivity);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('adminAccessToken');
          router.push('/admin/login');
          return;
        }
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [router]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">Platform overview and pending actions</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* Stat grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {STAT_CARDS(stats).map((card) => (
                <div
                  key={card.label}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center ${card.color}`}>
                      {card.icon}
                    </div>
                    {(card as { badge?: boolean }).badge && (
                      <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                    )}
                  </div>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value.toLocaleString()}</p>
                  <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Pending action banners */}
            {(stats.pendingKyc > 0 || stats.pendingProducts > 0 || stats.openComplaints > 0) && (
              <div className="mb-6 space-y-2">
                {stats.pendingKyc > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
                    <p className="text-orange-700 dark:text-orange-300 text-sm">
                      <span className="font-semibold">{stats.pendingKyc}</span> KYC application{stats.pendingKyc !== 1 ? 's' : ''} awaiting review
                    </p>
                    <a href="/admin/kyc" className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 text-xs font-medium">
                      Review →
                    </a>
                  </div>
                )}
                {stats.pendingProducts > 0 && (
                  <div className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
                    <p className="text-cyan-700 dark:text-cyan-300 text-sm">
                      <span className="font-semibold">{stats.pendingProducts}</span> product listing{stats.pendingProducts !== 1 ? 's' : ''} pending approval
                    </p>
                    <a href="/admin/products" className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 text-xs font-medium">
                      Review →
                    </a>
                  </div>
                )}
                {stats.openComplaints > 0 && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
                    <p className="text-red-700 dark:text-red-300 text-sm">
                      <span className="font-semibold">{stats.openComplaints}</span> complaint{stats.openComplaints !== 1 ? 's' : ''} open or in progress
                    </p>
                    <a href="/admin/complaints" className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs font-medium">
                      View →
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Recent activity */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Audit Activity</h2>
              </div>
              {activity.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-8">No recent activity</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {activity.map((item) => (
                    <div key={item.id} className="px-5 py-3 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                          <span className="text-gray-900 dark:text-white font-medium">{item.user?.email ?? 'System'}</span>
                          {' '}
                          <span className={
                            item.action === 'CREATE' ? 'text-emerald-600 dark:text-emerald-400' :
                            item.action === 'DELETE' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                          }>{item.action.toLowerCase()}</span>
                          {' '}
                          <span className="text-gray-500 dark:text-slate-400">{item.entityType}</span>
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">
                          {formatTime(item.createdAt)}
                          {item.ipAddress ? ` · ${item.ipAddress}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
