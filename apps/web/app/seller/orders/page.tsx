'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const authHeaders = () => {
  const t = localStorage.getItem('accessToken');
  return { Authorization: `Bearer ${t}` };
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  QUOTED:    { label: 'Quoted',    color: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED:  { label: 'Accepted',  color: 'bg-blue-100 text-blue-700' },
  REJECTED:  { label: 'Rejected',  color: 'bg-red-100 text-red-700' },
  FULFILLED: { label: 'Fulfilled', color: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Pending',  color: 'text-yellow-600' },
  COMPLETED: { label: 'Paid',     color: 'text-green-600' },
  FAILED:    { label: 'Failed',   color: 'text-red-600' },
  REFUNDED:  { label: 'Refunded', color: 'text-gray-500' },
};

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

interface Order {
  id: string;
  status: string;
  paymentStatus: string;
  finalPrice: number | null;
  quotedPrice: number | null;
  negotiatedPrice: number | null;
  buyerMasked: string;
  createdAt: string;
  updatedAt: string;
  product: { id: string; name: string } | null;
}

export default function SellerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast]     = useState('');

  // filters
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey]           = useState<SortKey>('newest');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/seller/orders`, {
        headers: authHeaders(),
        params: { page: 1, limit: 100 },
      });
      setOrders(res.data.data.items);
    } catch (e: unknown) {
      if ((e as { response?: { status?: number } }).response?.status === 401)
        router.push('/auth/signin?returnUrl=/seller/orders');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin?returnUrl=/seller/orders'); return; }
    load();
  }, [load, router]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(true);
    try {
      await axios.patch(`${API}/api/seller/orders/${orderId}/status`, { status }, { headers: authHeaders() });
      showToast(`Order marked as ${status.toLowerCase()}`);
      setSelected(null);
      load();
    } catch (e: unknown) {
      showToast((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Update failed');
    } finally { setUpdating(false); }
  };

  // ── derived counts & banners ──────────────────────────────────────────────
  const needFulfill = useMemo(() =>
    orders.filter((o) => o.status === 'ACCEPTED' && o.paymentStatus === 'COMPLETED').length,
  [orders]);
  const pendingPayment = useMemo(() =>
    orders.filter((o) => o.status === 'ACCEPTED' && o.paymentStatus === 'PENDING').length,
  [orders]);

  const countFor = (status: string) => orders.filter((o) => o.status === status).length;

  // ── filtered + sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (statusFilter && o.status !== statusFilter) return false;
        if (q) {
          const productMatch = o.product?.name?.toLowerCase().includes(q);
          const buyerMatch   = o.buyerMasked?.toLowerCase().includes(q);
          if (!productMatch && !buyerMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = Number(a.finalPrice ?? a.quotedPrice ?? 0);
        const priceB = Number(b.finalPrice ?? b.quotedPrice ?? 0);
        if (sortKey === 'oldest')  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortKey === 'highest') return priceB - priceA;
        if (sortKey === 'lowest')  return priceA - priceB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [orders, search, statusFilter, sortKey]);

  const hasFilters = search || statusFilter;
  const price = (o: Order) => o.finalPrice ?? o.quotedPrice;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">{orders.length} total orders</p>
      </div>

      {/* Action banners */}
      {needFulfill > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-medium text-blue-800">
            {needFulfill} order{needFulfill > 1 ? 's' : ''} paid — ready to be marked as fulfilled.
          </p>
          <button onClick={() => setStatusFilter('ACCEPTED')}
            className="ml-auto text-xs font-semibold text-blue-700 underline whitespace-nowrap">
            Show these
          </button>
        </div>
      )}
      {pendingPayment > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-medium text-yellow-800">
            {pendingPayment} accepted order{pendingPayment > 1 ? 's' : ''} awaiting buyer payment.
          </p>
          <button onClick={() => setStatusFilter('ACCEPTED')}
            className="ml-auto text-xs font-semibold text-yellow-700 underline whitespace-nowrap">
            Show these
          </button>
        </div>
      )}

      {/* Filter bar */}
      {!loading && orders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search product or buyer…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Sort */}
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest amount</option>
            <option value="lowest">Lowest amount</option>
          </select>

          {hasFilters && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Status pills with counts */}
      {!loading && orders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {['', 'QUOTED', 'ACCEPTED', 'FULFILLED', 'DELIVERED', 'REJECTED', 'CANCELLED'].map((s) => {
            const count = s === '' ? orders.length : countFor(s);
            if (count === 0 && s !== '') return null;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {s === '' ? 'All' : STATUS_CONFIG[s]?.label ?? s} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Buyer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-gray-400 text-sm">
                    {orders.length === 0 ? (
                      <>
                        <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        No orders yet
                      </>
                    ) : (
                      <>No orders match the current filters. <button onClick={() => { setSearch(''); setStatusFilter(''); }} className="text-blue-600 hover:underline">Clear filters</button></>
                    )}
                  </td>
                </tr>
              ) : filtered.map((o) => {
                const s  = STATUS_CONFIG[o.status]  ?? { label: o.status,        color: 'bg-gray-100 text-gray-600' };
                const p  = PAYMENT_CONFIG[o.paymentStatus] ?? { label: o.paymentStatus, color: 'text-gray-500' };
                const amt = price(o);
                const canFulfill = o.status === 'ACCEPTED' && o.paymentStatus === 'COMPLETED';
                return (
                  <tr key={o.id} className={`hover:bg-gray-50 transition-colors ${canFulfill ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 max-w-[180px] truncate">{o.product?.name ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{o.buyerMasked}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {amt != null ? `₹${Number(amt).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${p.color}`}>{p.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(o)}
                        className={`text-xs font-semibold ${canFulfill ? 'text-blue-600 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
                        {canFulfill ? 'Fulfill →' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Order Details</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Product</p>
                  <p className="font-medium text-gray-800">{selected.product?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Buyer</p>
                  <p className="font-medium text-gray-800">{selected.buyerMasked}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="font-medium text-gray-800">
                    {price(selected) != null ? `₹${Number(price(selected)).toLocaleString('en-IN')}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selected.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment</p>
                  <p className={`text-sm font-medium ${PAYMENT_CONFIG[selected.paymentStatus]?.color ?? 'text-gray-600'}`}>
                    {PAYMENT_CONFIG[selected.paymentStatus]?.label ?? selected.paymentStatus}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Placed on</p>
                  <p className="text-sm text-gray-700">{new Date(selected.createdAt).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {selected.status === 'QUOTED' && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    Quote sent to buyer — waiting for buyer to accept or negotiate.
                  </p>
                </div>
              )}

              {selected.status === 'ACCEPTED' && (
                <div className="border-t border-gray-100 pt-4">
                  {selected.paymentStatus !== 'COMPLETED' ? (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Waiting for buyer to upload payment. You can mark fulfilled once payment is confirmed.
                    </p>
                  ) : (
                    <button onClick={() => updateStatus(selected.id, 'FULFILLED')} disabled={updating}
                      className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                      {updating ? 'Saving…' : 'Mark as Fulfilled'}
                    </button>
                  )}
                </div>
              )}

              {(selected.status === 'FULFILLED' || selected.status === 'DELIVERED') && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    {selected.status === 'DELIVERED'
                      ? 'Buyer has confirmed delivery. Order is complete.'
                      : 'Marked as fulfilled — waiting for buyer to confirm delivery.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
