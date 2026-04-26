/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  QUOTED:    { label: 'Quoted',    color: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED:  { label: 'Accepted',  color: 'bg-blue-100 text-blue-700' },
  FULFILLED: { label: 'Fulfilled', color: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
  REJECTED:  { label: 'Rejected',  color: 'bg-red-100 text-red-600' },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Payment Pending', color: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: 'Paid',            color: 'bg-green-100 text-green-700' },
  FAILED:    { label: 'Payment Failed',  color: 'bg-red-100 text-red-600' },
  REFUNDED:  { label: 'Refunded',        color: 'bg-purple-100 text-purple-700' },
};

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

function Stepper({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const effectiveStatus =
    status === 'ACCEPTED' && paymentStatus === 'COMPLETED' ? 'PAYMENT' : status;
  const steps = ['QUOTED', 'ACCEPTED', 'PAYMENT', 'FULFILLED', 'DELIVERED'];
  const idx = steps.indexOf(effectiveStatus);
  return (
    <div className="flex items-center gap-0 mt-3">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const label = s === 'PAYMENT' ? 'Paid' : STATUS_CONFIG[s]?.label ?? s;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                done ? 'bg-blue-600 border-blue-600 text-white' : active ? 'bg-white border-blue-600 text-blue-600' : 'bg-white border-gray-200 text-gray-300'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${active ? 'text-blue-700 font-semibold' : done ? 'text-gray-600' : 'text-gray-300'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-14 mb-4 ${done ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BuyerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin?returnUrl=/buyer/orders'); return; }
    setLoading(true);
    setError(null);
    axios.get(`${API_URL}/api/buyer/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 100 },
    })
      .then((res) => setOrders(res.data?.data?.data ?? []))
      .catch((err) => {
        const s = err?.response?.status;
        if (s === 401 || s === 403) router.push('/auth/signin?returnUrl=/buyer/orders');
        else setError(err?.response?.data?.message ?? 'Failed to load orders');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── action banners ────────────────────────────────────────────────────────
  const needPayment   = useMemo(() => orders.filter((o) => o.status === 'ACCEPTED' && o.paymentStatus !== 'COMPLETED').length, [orders]);
  const needConfirm   = useMemo(() => orders.filter((o) => o.status === 'FULFILLED').length, [orders]);

  // ── filtered + sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (statusFilter && o.status !== statusFilter) return false;
        if (q && !o.productName?.toLowerCase().includes(q) && !o.sellerName?.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'oldest')  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortKey === 'highest') return Number(b.basePrice ?? b.totalPayable) - Number(a.basePrice ?? a.totalPayable);
        if (sortKey === 'lowest')  return Number(a.basePrice ?? a.totalPayable) - Number(b.basePrice ?? b.totalPayable);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [orders, search, statusFilter, sortKey]);

  const countFor = (status: string) => orders.filter((o) => o.status === status).length;
  const hasFilters = search || statusFilter;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} total orders</p>
        </div>
      </div>

      {/* Action banners */}
      {needPayment > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-medium text-orange-800">
            {needPayment} order{needPayment > 1 ? 's' : ''} accepted — upload payment receipt to proceed.
          </p>
              <button onClick={() => setStatusFilter('ACCEPTED')}
            className="ml-auto text-xs font-semibold text-orange-700 underline whitespace-nowrap">
            Show these
          </button>
        </div>
      )}
      {needConfirm > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-medium text-indigo-800">
            {needConfirm} order{needConfirm > 1 ? 's' : ''} fulfilled by seller — confirm delivery to close.
          </p>
          <button onClick={() => setStatusFilter('FULFILLED')}
            className="ml-auto text-xs font-semibold text-indigo-700 underline whitespace-nowrap">
            Show these
          </button>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-4 text-sm">{error}</div>}

      {/* Filter bar */}
      {!loading && !error && orders.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search product or seller…" value={search}
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

      {/* Status filter pills (below filter bar for prominence) */}
      {!loading && !error && orders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {['', 'QUOTED', 'ACCEPTED', 'FULFILLED', 'DELIVERED', 'CANCELLED', 'REJECTED'].map((s) => {
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

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-48 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm mb-3">No orders yet.</p>
          <Link href="/buyer/quotes" className="text-sm text-blue-600 hover:underline font-medium">
            View quotes to accept an order →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
          No orders match the current filters.{' '}
          <button onClick={() => { setSearch(''); setStatusFilter(''); }}
            className="text-blue-600 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const statusConf = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' };
            const payConf    = PAYMENT_CONFIG[order.paymentStatus] ?? { label: order.paymentStatus, color: 'bg-gray-100 text-gray-600' };
            const needsAction =
              (order.status === 'ACCEPTED' && order.paymentStatus !== 'COMPLETED') ||
              order.status === 'FULFILLED';
            return (
              <div key={order.id}
                className={`bg-white rounded-xl border p-5 hover:shadow-sm transition ${needsAction ? 'border-blue-200' : 'border-gray-200 hover:border-blue-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{order.productName ?? 'N/A'}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{order.sellerName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConf.color}`}>
                      {statusConf.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payConf.color}`}>
                      {payConf.label}
                    </span>
                  </div>
                </div>

                <Stepper status={order.status} paymentStatus={order.paymentStatus} />

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Agreed price</p>
                    <p className="text-lg font-bold text-gray-900">
                      ₹{Number(order.basePrice ?? order.totalPayable).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <Link href={`/buyer/orders/${order.id}`}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                      needsAction
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    {order.status === 'ACCEPTED' && order.paymentStatus !== 'COMPLETED'
                      ? 'Upload Receipt'
                      : order.status === 'FULFILLED'
                        ? 'Confirm Delivery'
                        : 'View Details'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
