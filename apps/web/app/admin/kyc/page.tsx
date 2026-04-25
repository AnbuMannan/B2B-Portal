'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface KycQueueItem {
  id: string;
  companyName: string;
  companyType: string;
  state: string | null;
  city: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  hasIEC: boolean;
  iecCode: string | null;
  updatedAt: string;
  elapsedHours: number;
  hoursRemaining: number;
  slaStatus: 'GREEN' | 'YELLOW' | 'RED';
  user: { email: string; phoneNumber: string | null };
}

interface KycStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  avgReviewTime: number;
  slaBreaches: number;
}

const SLA_COLORS = {
  GREEN:  { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', label: 'On track' },
  YELLOW: { bg: 'bg-yellow-50 dark:bg-yellow-500/10',   text: 'text-yellow-700 dark:text-yellow-400',   border: 'border-yellow-200 dark:border-yellow-500/30',   label: 'Warning' },
  RED:    { bg: 'bg-red-50 dark:bg-red-500/10',         text: 'text-red-700 dark:text-red-400',         border: 'border-red-200 dark:border-red-500/30',         label: 'Breach risk' },
};

export default function AdminKycQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<KycQueueItem[]>([]);
  const [stats, setStats] = useState<KycStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('adminAccessToken');
    if (!token) { router.push('/admin/login'); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API_URL}/api/admin/kyc/queue`, { headers }),
      axios.get(`${API_URL}/api/admin/kyc/stats`, { headers }),
    ])
      .then(([qRes, sRes]) => {
        setQueue(qRes.data.data);
        setStats(sRes.data.data);
      })
      .catch((err) => {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          router.push('/admin/login');
          return;
        }
        setError('Failed to load KYC queue');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">KYC Approval Queue</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">48-hour SLA. Oldest applications first (FIFO).</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Pending', value: stats.pending, color: 'text-yellow-600 dark:text-yellow-400' },
              { label: 'Approved Today', value: stats.approvedToday, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Rejected Today', value: stats.rejectedToday, color: 'text-red-600 dark:text-red-400' },
              { label: 'Avg Review Time', value: `${stats.avgReviewTime}h`, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'SLA Breaches', value: stats.slaBreaches, color: stats.slaBreaches > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && queue.length === 0 && !error && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center">
            <p className="text-emerald-600 dark:text-emerald-400 text-lg font-semibold">All clear!</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">No pending KYC applications.</p>
          </div>
        )}

        {queue.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 text-left bg-gray-50 dark:bg-transparent">
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Company</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Type</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">State</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Submitted</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">SLA Status</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">GSTIN</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">PAN</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {queue.map((item) => {
                    const sla = SLA_COLORS[item.slaStatus];
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/kyc/${item.id}`)}
                      >
                        <td className="px-4 py-3">
                          <p className="text-gray-900 dark:text-white font-medium truncate max-w-[180px]">{item.companyName}</p>
                          <p className="text-gray-400 dark:text-slate-500 text-xs truncate">{item.user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                          {item.companyType.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                          {item.city ?? '—'}{item.state ? `, ${item.state}` : ''}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs">
                          {formatDate(item.updatedAt)}
                          <p className="text-gray-400 dark:text-slate-500">{item.elapsedHours}h ago</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sla.bg} ${sla.text} ${sla.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.slaStatus === 'RED' ? 'bg-red-500 animate-pulse' : item.slaStatus === 'YELLOW' ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                            {sla.label}
                            {item.hoursRemaining > 0 ? ` · ${item.hoursRemaining}h left` : ' · Overdue'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300 text-xs font-mono">
                          {item.gstNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300 text-xs font-mono">
                          {item.panNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/admin/kyc/${item.id}`); }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-colors"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
