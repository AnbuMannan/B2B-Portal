'use client';

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('adminAccessToken')}` });

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  UPDATE: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  DELETE: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
};

const ENTITY_TYPES = ['', 'SELLER_KYC', 'PRODUCT_LISTING', 'BUYER_FRAUD'];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE'];

interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; email: string; adminRole: string | null } | null;
}

export default function AuditLogsPage() {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (entityType) params.entityType = entityType;
      if (action) params.action = action;
      const res = await axios.get(`${API}/api/admin/dashboard/audit-logs`, { headers: headers(), params });
      setLogs(res.data.data.items);
      setTotal(res.data.data.total);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [page, entityType, action]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Logs</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Full trail of all admin and system actions</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Entity Types</option>
            {ENTITY_TYPES.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Actions</option>
            {ACTIONS.slice(1).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="text-gray-500 dark:text-gray-400 text-sm ml-auto">{total} entries</span>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-transparent">
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Actor</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-left">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                    </td></tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">No audit logs found</td></tr>
                ) : logs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-800 dark:text-gray-200 text-xs">{log.user?.email ?? 'System'}</div>
                        {log.user?.adminRole && (
                          <div className="text-gray-400 dark:text-gray-500 text-xs">{log.user.adminRole}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 dark:text-gray-300 text-xs">{log.entityType}</div>
                        <div className="text-gray-400 dark:text-gray-500 text-xs font-mono truncate max-w-[140px]">{log.entityId}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs">{log.ipAddress ?? '—'}</td>
                      <td className="px-4 py-3">
                        {!!log.newValue && (
                          <button onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">
                            {expanded === log.id ? 'hide' : 'show'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === log.id && !!log.newValue && (
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <td colSpan={6} className="px-6 py-3">
                          <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.newValue, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40">
                  Previous
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
