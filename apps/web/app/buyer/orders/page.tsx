/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  QUOTED:    { label: 'Quoted',    color: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED:  { label: 'Accepted',  color: 'bg-blue-100 text-blue-700' },
  FULFILLED: { label: 'Fulfilled', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
  REJECTED:  { label: 'Rejected',  color: 'bg-red-100 text-red-600' },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Payment Pending', color: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: 'Paid',            color: 'bg-green-100 text-green-700' },
  FAILED:    { label: 'Payment Failed',  color: 'bg-red-100 text-red-600' },
  REFUNDED:  { label: 'Refunded',        color: 'bg-purple-100 text-purple-700' },
};

function Stepper({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const effectiveStatus =
    status === 'ACCEPTED' && paymentStatus === 'COMPLETED'
      ? 'PAYMENT'
      : status;
  const steps = ['QUOTED', 'ACCEPTED', 'PAYMENT', 'FULFILLED'];
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
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  done
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : active
                      ? 'bg-white border-blue-600 text-blue-600'
                      : 'bg-white border-gray-200 text-gray-300'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${active ? 'text-blue-700 font-semibold' : done ? 'text-gray-600' : 'text-gray-300'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-10 sm:w-16 mb-4 ${done ? 'bg-blue-600' : 'bg-gray-200'}`} />
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
  const [statusFilter, setStatusFilter] = useState('');

  const load = async (status?: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin?returnUrl=/buyer/orders'); return; }
    setLoading(true);
    setError(null);
    try {
      const params: any = { limit: 50 };
      if (status) params.status = status;
      const res = await axios.get(`${API_URL}/api/buyer/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setOrders(res.data?.data?.data ?? []);
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 401 || s === 403) router.push('/auth/signin?returnUrl=/buyer/orders');
      else setError(err?.response?.data?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(statusFilter || undefined); }, [statusFilter]);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage your purchase orders</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['', 'QUOTED', 'ACCEPTED', 'FULFILLED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-5 text-sm">{error}</div>
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
          <Link
            href="/buyer/quotes"
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            View quotes to accept an order →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusConf = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' };
            const payConf = PAYMENT_CONFIG[order.paymentStatus] ?? { label: order.paymentStatus, color: 'bg-gray-100 text-gray-600' };
            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{order.productName}</p>
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
                    <p className="text-xs text-gray-500">Total payable</p>
                    <p className="text-lg font-bold text-gray-900">
                      ₹{Number(order.totalPayable).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400">
                      incl. 15% platform fee (₹{Number(order.platformFacilitationFee).toLocaleString('en-IN')})
                    </p>
                  </div>
                  <Link
                    href={`/buyer/orders/${order.id}`}
                    className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    View Details
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
