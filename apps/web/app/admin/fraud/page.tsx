'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface FraudIndicator { rule: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; detail: string }
interface SuspiciousAccount {
  userId: string; email: string; phoneNumber: string | null;
  isActive: boolean; createdAt: string; role: string;
  indicators: FraudIndicator[]; riskScore: number; isBlocked: boolean;
}
interface BlockEntry {
  id: string; userId: string | null; email: string | null;
  phoneNumber: string | null; reason: string; blockedBy: string; blockedAt: string; notes: string | null;
}
interface StateCount { state: string; count: number }

type Tab = 'suspicious' | 'blocklist' | 'heatmap';

const SEVERITY_STYLE = {
  HIGH:   'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
  MEDIUM: 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
  LOW:    'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600',
};

const RISK_COLOR = (score: number) =>
  score >= 60 ? 'text-red-600 dark:text-red-400' : score >= 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400';

const RULE_LABELS: Record<string, string> = {
  DUPLICATE_PHONE:         'Duplicate Phone',
  SUSPICIOUS_EMAIL_PATTERN:'Email Pattern',
  BULK_LEAD_POSTING:       'Bulk Leads',
  REPEATED_PRODUCT_LEAD:   'Repeated Product',
};

function StateHeatmap({ data }: { data: StateCount[] }) {
  const max = data[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
        <p className="text-gray-500 dark:text-slate-400 text-xs mb-3">Lead volume by delivery state</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {data.map(({ state, count }, i) => {
            const pct = Math.round((count / max) * 100);
            const intensity = pct > 75 ? 'bg-red-500' : pct > 50 ? 'bg-orange-500' : pct > 25 ? 'bg-yellow-500' : 'bg-blue-500';
            return (
              <div key={state} className="flex items-center gap-3">
                <span className="text-gray-400 dark:text-slate-400 text-xs w-5 text-right">{i + 1}</span>
                <span className="text-gray-800 dark:text-slate-200 text-sm w-40 truncate">{state}</span>
                <div className="flex-1 bg-gray-200 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className={`${intensity} h-2 rounded-full transition-all`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <span className="text-gray-500 dark:text-slate-400 text-xs w-10 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {data.slice(0, 6).map(({ state, count }) => {
          const pct = Math.round((count / max) * 100);
          const bg = pct > 75 ? 'bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/40' :
                     pct > 50 ? 'bg-orange-50 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/40' :
                     pct > 25 ? 'bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/40' :
                                'bg-blue-50 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/40';
          const text = pct > 75 ? 'text-red-700 dark:text-red-300' : pct > 50 ? 'text-orange-700 dark:text-orange-300' : pct > 25 ? 'text-yellow-700 dark:text-yellow-300' : 'text-blue-700 dark:text-blue-300';
          return (
            <div key={state} className={`border rounded-xl p-3 text-center ${bg}`}>
              <p className={`text-xl font-bold ${text}`}>{count}</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5 truncate">{state}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminFraudPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('suspicious');
  const [suspicious, setSuspicious] = useState<SuspiciousAccount[]>([]);
  const [blocklist, setBlocklist] = useState<BlockEntry[]>([]);
  const [stateData, setStateData] = useState<StateCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [blockTarget, setBlockTarget] = useState<SuspiciousAccount | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [unblockTarget, setUnblockTarget] = useState<BlockEntry | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const token = () => localStorage.getItem('adminAccessToken') ?? '';
  const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

  const fetchTab = useCallback(async (t: Tab) => {
    if (!token()) { router.push('/admin/login'); return; }
    setLoading(true); setError(null);
    try {
      if (t === 'suspicious') {
        const res = await axios.get(`${API_URL}/api/admin/fraud/suspicious`, { headers: authHeaders() });
        setSuspicious(res.data.data);
      } else if (t === 'blocklist') {
        const res = await axios.get(`${API_URL}/api/admin/fraud/blocklist`, { headers: authHeaders() });
        setBlocklist(res.data.data.items);
      } else {
        const res = await axios.get(`${API_URL}/api/admin/fraud/leads-by-state`, { headers: authHeaders() });
        setStateData(res.data.data);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) { router.push('/admin/login'); return; }
      setError('Failed to load data');
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  const handleBlock = async () => {
    if (!blockTarget || blockReason.trim().length < 10) {
      setActionError('Reason must be at least 10 characters.');
      return;
    }
    setActionSubmitting(true); setActionError(null);
    try {
      await axios.post(
        `${API_URL}/api/admin/fraud/block`,
        { userId: blockTarget.userId, reason: blockReason },
        { headers: authHeaders() },
      );
      setSuspicious((prev) =>
        prev.map((s) => s.userId === blockTarget.userId ? { ...s, isBlocked: true, isActive: false } : s),
      );
      setBlockTarget(null); setBlockReason('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Block failed');
    } finally { setActionSubmitting(false); }
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setActionSubmitting(true); setActionError(null);
    try {
      await axios.post(
        `${API_URL}/api/admin/fraud/unblock`,
        { userId: unblockTarget.userId },
        { headers: authHeaders() },
      );
      setBlocklist((prev) => prev.filter((b) => b.id !== unblockTarget.id));
      setUnblockTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Unblock failed');
    } finally { setActionSubmitting(false); }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'suspicious', label: `⚠ Suspicious (${suspicious.length || '—'})` },
    { key: 'blocklist',  label: `🚫 Block List (${blocklist.length || '—'})` },
    { key: 'heatmap',   label: '🗺 Lead Heatmap' },
  ];

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fraud Management</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">Automated detection · Block list · Geographic analysis</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── SUSPICIOUS ── */}
        {tab === 'suspicious' && !loading && (
          <>
            {suspicious.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center">
                <p className="text-emerald-600 dark:text-emerald-400 font-semibold">No suspicious accounts detected</p>
                <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">Fraud rules found no violations. Nightly scan runs at 2 AM.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suspicious.map((account) => (
                  <div key={account.userId} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          <span className="text-gray-900 dark:text-white font-medium">{account.email}</span>
                          {account.phoneNumber && (
                            <span className="text-gray-400 dark:text-slate-500 text-xs font-mono">{account.phoneNumber}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${RISK_COLOR(account.riskScore)} bg-gray-100 dark:bg-slate-800`}>
                            Risk {account.riskScore}
                          </span>
                          {!account.isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                              {account.isBlocked ? 'Blocked' : 'Inactive'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {account.indicators.map((ind, i) => (
                            <span key={i} className={`text-xs px-2.5 py-1 rounded-full border ${SEVERITY_STYLE[ind.severity]}`}
                              title={ind.detail}>
                              {RULE_LABELS[ind.rule] ?? ind.rule} · {ind.detail}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {!account.isBlocked && account.isActive && (
                          <button
                            onClick={() => { setBlockTarget(account); setBlockReason(''); setActionError(null); }}
                            className="px-3 py-1.5 bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs rounded-lg font-medium transition-colors"
                          >
                            Block
                          </button>
                        )}
                        {account.isBlocked && (
                          <span className="text-xs text-red-600 dark:text-red-400 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20">
                            Blocked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── BLOCKLIST ── */}
        {tab === 'blocklist' && !loading && (
          <>
            {blocklist.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center">
                <p className="text-gray-500 dark:text-slate-400 font-semibold">Block list is empty</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-transparent">
                      {['Email', 'Phone', 'Reason', 'Blocked At', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {blocklist.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-gray-800 dark:text-slate-200 text-sm">{entry.email ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs font-mono">{entry.phoneNumber ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs max-w-[240px] truncate" title={entry.reason}>
                          {entry.reason}
                        </td>
                        <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs whitespace-nowrap">
                          {new Date(entry.blockedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setUnblockTarget(entry); setActionError(null); }}
                            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg font-medium transition-colors"
                          >
                            Unblock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── HEATMAP ── */}
        {tab === 'heatmap' && !loading && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Lead Geographic Distribution</h2>
                <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">Buy lead volume by delivery state · {stateData.reduce((a, s) => a + s.count, 0)} total leads</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Low</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" />Medium</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />High</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Very High</span>
              </div>
            </div>
            {stateData.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-500 text-center py-8 text-sm">No lead data with delivery states yet</p>
            ) : (
              <StateHeatmap data={stateData} />
            )}
          </div>
        )}
      </div>

      {/* Block confirmation dialog */}
      {blockTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Block Account</h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-4">
              Blocking <span className="text-gray-900 dark:text-white font-medium">{blockTarget.email}</span> will deactivate their account immediately.
            </p>
            <div className="mb-1">
              <p className="text-gray-500 dark:text-slate-400 text-xs mb-1 font-medium">Detected indicators:</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {blockTarget.indicators.map((ind, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_STYLE[ind.severity]}`}>
                    {RULE_LABELS[ind.rule] ?? ind.rule}
                  </span>
                ))}
              </div>
            </div>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Block reason (min 10 chars) — this is logged in the audit trail"
              rows={3}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            {actionError && <p className="text-red-500 text-xs mt-2">{actionError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setBlockTarget(null); setBlockReason(''); setActionError(null); }}
                disabled={actionSubmitting}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleBlock} disabled={actionSubmitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {actionSubmitting ? 'Blocking…' : 'Confirm Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock confirmation dialog */}
      {unblockTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Unblock Account</h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-1">
              Restoring <span className="text-gray-900 dark:text-white font-medium">{unblockTarget.email}</span>. Their account will be reactivated.
            </p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mb-4">
              Blocked for: <span className="text-gray-600 dark:text-slate-400">{unblockTarget.reason}</span>
            </p>
            {actionError && <p className="text-red-500 text-xs mb-3">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setUnblockTarget(null); setActionError(null); }}
                disabled={actionSubmitting}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleUnblock} disabled={actionSubmitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {actionSubmitting ? 'Unblocking…' : 'Confirm Unblock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
