'use client';

import { useEffect, useState, useCallback } from 'react';
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
  FULFILLED: { label: 'Fulfilled', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Pending',   color: 'text-yellow-600' },
  COMPLETED: { label: 'Paid',      color: 'text-green-600' },
  FAILED:    { label: 'Failed',    color: 'text-red-600' },
  REFUNDED:  { label: 'Refunded',  color: 'text-gray-500' },
};

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
  product: { id: string; name: string };
}

const STATUSES = ['', 'QUOTED', 'ACCEPTED', 'REJECTED', 'FULFILLED', 'CANCELLED'];

export default function SellerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders]       = useState<Order[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Order | null>(null);
  const [updating, setUpdating]   = useState(false);
  const [toast, setToast]         = useState('');
  const limit = 20;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      const res = await axios.get(`${API}/api/seller/orders`, { headers: authHeaders(), params });
      setOrders(res.data.data.items);
      setTotal(res.data.data.total);
    } catch (e: unknown) {
      if ((e as {response?: {status?: number}}).response?.status === 401) router.push('/auth/signin?returnUrl=/seller/orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, router]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin?returnUrl=/seller/orders'); return; }
    load();
  }, [load, router]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(true);
    try {
      await axios.patch(`${API}/api/seller/orders/${orderId}/status`, { status }, { headers: authHeaders() });
      showToast(`Order ${status.toLowerCase()}`);
      setSelected(null);
      load();
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Update failed');
    } finally { setUpdating(false); }
  };

  const totalPages = Math.ceil(total / limit);
  const price = (o: Order) => o.finalPrice ?? o.quotedPrice;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total orders</p>
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>
      </div>

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
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                    <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    No orders found
                  </td>
                </tr>
              ) : orders.map(o => {
                const s = STATUS_CONFIG[o.status] ?? { label: o.status, color: 'bg-gray-100 text-gray-600' };
                const p = PAYMENT_CONFIG[o.paymentStatus] ?? { label: o.paymentStatus, color: 'text-gray-500' };
                const amt = price(o);
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 max-w-[180px] truncate">{o.product.name}</div>
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
                      <button
                        onClick={() => setSelected(o)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                Previous
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
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
                  <p className="font-medium text-gray-800">{selected.product.name}</p>
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
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Placed on</p>
                  <p className="text-sm text-gray-700">{new Date(selected.createdAt).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Action buttons — only for QUOTED orders */}
              {selected.status === 'QUOTED' && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Update Order Status</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateStatus(selected.id, 'ACCEPTED')}
                      disabled={updating}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {updating ? 'Saving…' : 'Accept Order'}
                    </button>
                    <button
                      onClick={() => updateStatus(selected.id, 'REJECTED')}
                      disabled={updating}
                      className="flex-1 px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {selected.status === 'ACCEPTED' && (
                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => updateStatus(selected.id, 'FULFILLED')}
                    disabled={updating}
                    className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {updating ? 'Saving…' : 'Mark as Fulfilled'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
