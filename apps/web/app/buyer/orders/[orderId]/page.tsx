/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadOrder = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push(`/auth/signin?returnUrl=/buyer/orders/${orderId}`); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/buyer/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrder(res.data?.data);
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 401 || s === 403) router.push('/auth/signin');
      else if (s === 404) setError('Order not found');
      else setError(err?.response?.data?.message ?? 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadOrder(); }, [orderId]);

  const handlePay = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setPayLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { showToast('Razorpay SDK failed to load. Check your connection.'); return; }

      const res = await axios.post(`${API_URL}/api/buyer/orders/${orderId}/pay`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { razorpayOrderId, amount, currency, keyId } = res.data.data;

      const options = {
        key: keyId,
        amount,
        currency: currency ?? 'INR',
        name: 'B2B Marketplace',
        description: `Order ${orderId.slice(-8).toUpperCase()}`,
        order_id: razorpayOrderId,
        handler: async (response: any) => {
          try {
            await axios.post(
              `${API_URL}/api/buyer/orders/${orderId}/verify-payment`,
              {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
              { headers: { Authorization: `Bearer ${token}` } },
            );
            showToast('Payment successful!');
            await loadOrder();
          } catch {
            showToast('Payment verification failed. Contact support.');
          }
        },
        prefill: {},
        theme: { color: '#2563EB' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Could not initiate payment');
    } finally {
      setPayLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!confirm('Confirm that you have received the goods/services?')) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setConfirmLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/buyer/orders/${orderId}/confirm-delivery`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showToast('Order marked as fulfilled!');
      await loadOrder();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Could not confirm delivery');
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-24 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">{error}</div>
        <Link href="/buyer/orders" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Back to orders</Link>
      </div>
    );
  }

  const p = order?.pricing ?? {};
  const canPay = order?.status === 'ACCEPTED' && order?.paymentStatus !== 'COMPLETED';
  const canConfirm = order?.status === 'ACCEPTED' && order?.paymentStatus === 'COMPLETED';

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link href="/buyer/orders" className="text-gray-400 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order Detail</h1>
          <p className="text-xs text-gray-500 font-mono">{order.id}</p>
        </div>
      </div>

      {/* Status + actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-semibold text-gray-900">{order.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Payment</p>
            <p className="font-semibold text-gray-900">{order.paymentStatus}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canPay && (
              <button
                onClick={handlePay}
                disabled={payLoading}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {payLoading ? 'Opening…' : 'Pay Now'}
              </button>
            )}
            {canConfirm && (
              <button
                onClick={handleConfirmDelivery}
                disabled={confirmLoading}
                className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                {confirmLoading ? 'Confirming…' : 'Confirm Delivery'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pricing breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Price Breakdown</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Base price</dt>
            <dd className="font-medium text-gray-900">₹{Number(p.basePrice ?? 0).toLocaleString('en-IN')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Platform facilitation fee (15%)</dt>
            <dd className="font-medium text-gray-900">₹{Number(p.platformFacilitationFee ?? 0).toLocaleString('en-IN')}</dd>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <dt className="font-semibold text-gray-900">Total payable</dt>
            <dd className="font-bold text-blue-700 text-base">₹{Number(p.totalPayable ?? 0).toLocaleString('en-IN')}</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-400 mt-3">
          * Platform facilitation fee is non-refundable. Prices in INR, GST may apply.
        </p>
      </div>

      {/* Seller + Product */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Seller</p>
          <p className="font-semibold text-gray-900">{order.seller?.companyName}</p>
          {order.seller?.city && (
            <p className="text-sm text-gray-500">{[order.seller.city, order.seller.state].filter(Boolean).join(', ')}</p>
          )}
          {order.seller?.isVerified && (
            <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Verified Seller
            </span>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Product</p>
          <p className="font-semibold text-gray-900">{order.product?.name ?? 'N/A'}</p>
          {order.product?.hsnCode && (
            <p className="text-sm text-gray-500">HSN: {order.product.hsnCode}</p>
          )}
          {order.quote?.leadTime && (
            <p className="text-sm text-gray-500 mt-1">Lead time: {order.quote.leadTime}</p>
          )}
        </div>
      </div>

      {/* Quote notes */}
      {order.quote?.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Seller Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{order.quote.notes}</p>
        </div>
      )}

      <div className="text-xs text-gray-400 text-center mt-4">
        Order placed {new Date(order.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric'
        })}
      </div>
    </div>
  );
}
