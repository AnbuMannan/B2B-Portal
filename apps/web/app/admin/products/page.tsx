'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface Category { id: string; name: string }
interface ProductItem {
  id: string;
  name: string;
  description: string | null;
  hsnCode: string | null;
  unit: string | null;
  images: string[] | null;
  adminApprovalStatus: string;
  isFlagged: boolean;
  flagReason: string | null;
  createdAt: string;
  seller: { id: string; companyName: string; state: string | null; user: { email: string } };
  categories: { category: Category }[];
}

type Tab = 'queue' | 'flagged';

interface RejectState { productId: string; productName: string }

export default function AdminProductsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('queue');
  const [items, setItems] = useState<ProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectState, setRejectState] = useState<RejectState | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const adminToken = () => localStorage.getItem('adminAccessToken') ?? '';
  const headers = () => ({ Authorization: `Bearer ${adminToken()}` });

  const fetchItems = useCallback(async () => {
    if (!adminToken()) { router.push('/admin/login'); return; }
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const endpoint = tab === 'queue' ? 'queue' : 'flagged';
      const res = await axios.get(`${API_URL}/api/admin/products/${endpoint}`, { headers: headers() });
      setItems(res.data.data.items);
      setTotal(res.data.data.total);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) { router.push('/admin/login'); return; }
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, router]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleApprove = async (productId: string) => {
    setSubmitting(true);
    setActionError(null);
    try {
      await axios.post(`${API_URL}/api/admin/products/${productId}/approve`, {}, { headers: headers() });
      setItems((prev) => prev.filter((p) => p.id !== productId));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Approve failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectState || rejectReason.trim().length < 10) {
      setActionError('Reason must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await axios.post(
        `${API_URL}/api/admin/products/${rejectState.productId}/reject`,
        { reason: rejectReason },
        { headers: headers() },
      );
      setItems((prev) => prev.filter((p) => p.id !== rejectState.productId));
      setRejectState(null);
      setRejectReason('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Reject failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setBulkSubmitting(true);
    setActionError(null);
    try {
      await axios.post(
        `${API_URL}/api/admin/products/bulk-approve`,
        { productIds: Array.from(selected) },
        { headers: headers() },
      );
      setItems((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Bulk approve failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((p) => p.id)));
    }
  };

  const thumbnail = (item: ProductItem): string | null => {
    const imgs = item.images as unknown as string[];
    return imgs?.[0] ?? null;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <AdminShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Product Approvals</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
              {total} item{total !== 1 ? 's' : ''} in {tab === 'queue' ? 'pending queue' : 'flagged list'}
            </p>
          </div>
          {selected.size > 0 && tab === 'queue' && (
            <button
              onClick={handleBulkApprove}
              disabled={bulkSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {bulkSubmitting ? 'Approving…' : `Approve ${selected.size} selected`}
            </button>
          )}
        </div>

        {actionError && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
            {actionError}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-1 w-fit">
          {(['queue', 'flagged'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {t === 'queue' ? 'Pending Queue' : '⚑ Flagged'}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center">
            <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {tab === 'queue' ? 'No pending products' : 'No flagged products'}
            </p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
              {tab === 'queue' ? 'All listings are reviewed.' : 'Keyword screener found no violations.'}
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-left bg-gray-50 dark:bg-transparent">
                  {tab === 'queue' && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-500 focus:ring-blue-500"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Product</th>
                  <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Seller</th>
                  <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Category</th>
                  <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Submitted</th>
                  {tab === 'flagged' && (
                    <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Flag Reason</th>
                  )}
                  <th className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {items.map((item) => {
                  const thumb = thumbnail(item);
                  const cats = item.categories.map((c) => c.category.name).join(', ');
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                      {tab === 'queue' && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-500 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`${API_URL}${thumb}`}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">{item.name}</p>
                            <p className="text-gray-400 dark:text-slate-500 text-xs truncate max-w-[200px]">
                              {item.description ?? '—'}
                            </p>
                            {item.hsnCode && (
                              <p className="text-gray-400 dark:text-slate-600 text-xs font-mono">HSN: {item.hsnCode}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 dark:text-slate-200 truncate max-w-[140px]">{item.seller.companyName}</p>
                        <p className="text-gray-400 dark:text-slate-500 text-xs truncate">{item.seller.user.email}</p>
                        {item.seller.state && (
                          <p className="text-gray-400 dark:text-slate-600 text-xs">{item.seller.state}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs max-w-[120px] truncate">
                        {cats || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 dark:text-slate-400 text-xs whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>
                      {tab === 'flagged' && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded px-2 py-1 max-w-[180px] truncate">
                            {item.flagReason ?? 'Flagged'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={submitting}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => { setRejectState({ productId: item.id, productName: item.name }); setRejectReason(''); setActionError(null); }}
                            disabled={submitting}
                            className="px-3 py-1.5 bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject dialog */}
      {rejectState && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Reject Product</h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-4 truncate">&ldquo;{rejectState.productName}&rdquo;</p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Product description contains misleading claims. Please revise and resubmit."
              rows={4}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />

            {actionError && (
              <p className="text-red-500 text-xs mt-2">{actionError}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectState(null); setRejectReason(''); setActionError(null); }}
                disabled={submitting}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
