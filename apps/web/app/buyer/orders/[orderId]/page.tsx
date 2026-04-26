/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Receipt upload state
  const [showPayModal, setShowPayModal] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raise request (complaint) state
  const [showComplaint, setShowComplaint] = useState(false);
  const [complaint, setComplaint] = useState({ category: 'OTHER', subject: '', description: '' });
  const [complaintLoading, setComplaintLoading] = useState(false);

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

  const handleMarkPaid = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setUploading(true);
    try {
      let receiptUrl: string | undefined;

      if (receiptFile) {
        const form = new FormData();
        form.append('file', receiptFile);
        const up = await axios.post(`${API_URL}/api/upload/receipt`, form, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        receiptUrl = up.data?.data?.url ?? up.data?.url;
      }

      await axios.post(
        `${API_URL}/api/buyer/orders/${orderId}/mark-paid`,
        receiptUrl ? { receiptUrl } : {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showToast('Payment recorded successfully!');
      setShowPayModal(false);
      setReceiptFile(null);
      await loadOrder();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Could not record payment');
    } finally {
      setUploading(false);
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
      showToast('Delivery confirmed!');
      await loadOrder();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Could not confirm delivery');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleRaiseRequest = async () => {
    if (!complaint.subject.trim() || !complaint.description.trim()) {
      showToast('Subject and description are required');
      return;
    }
    if (complaint.description.trim().length < 20) {
      showToast('Description must be at least 20 characters');
      return;
    }
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setComplaintLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/complaints`,
        {
          reportedUserId: order.seller.userId,
          category: complaint.category,
          subject: complaint.subject.trim(),
          description: complaint.description.trim(),
          orderId: order.id,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showToast('Request raised — admin will review and contact you.');
      setShowComplaint(false);
      setComplaint({ category: 'OTHER', subject: '', description: '' });
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Failed to raise request');
    } finally {
      setComplaintLoading(false);
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
  const canConfirm = order?.status === 'FULFILLED';

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
                onClick={() => setShowPayModal(true)}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Upload Payment Receipt
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
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Price</h2>
        <dl className="space-y-2 text-sm">
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <dt className="font-semibold text-gray-900">Agreed price</dt>
            <dd className="font-bold text-blue-700 text-base">₹{Number(p.basePrice ?? 0).toLocaleString('en-IN')}</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-400 mt-3">Prices in INR. GST and delivery charges as agreed with seller.</p>
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

      {/* Raise a request — available on any non-cancelled order */}
      {order.status !== 'CANCELLED' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Have an issue with this order?</p>
              <p className="text-xs text-gray-400 mt-0.5">Admin will review and get back to you within 24 hours.</p>
            </div>
            <button
              onClick={() => setShowComplaint(true)}
              className="px-4 py-2 text-sm font-semibold border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition"
            >
              Raise a Request
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 text-center mt-4">
        Order placed {new Date(order.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric'
        })}
      </div>

      {/* Payment receipt upload modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Upload Payment Receipt</h2>
              <button onClick={() => { setShowPayModal(false); setReceiptFile(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                After paying the seller outside this platform, upload your payment proof (screenshot, bank receipt, UPI confirmation etc.) to mark this order as paid.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition"
              >
                {receiptFile ? (
                  <div>
                    <p className="text-sm font-medium text-gray-800">{receiptFile.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{(receiptFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-sm text-gray-500">Click to upload receipt</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF up to 10 MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <p className="text-xs text-gray-400">
                Receipt upload is optional — you can also just click &quot;Mark as Paid&quot; without a file if you have verbal confirmation.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowPayModal(false); setReceiptFile(null); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkPaid}
                  disabled={uploading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {uploading ? 'Saving…' : 'Mark as Paid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complaint modal */}
      {showComplaint && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Raise a Request</h2>
              <button onClick={() => setShowComplaint(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                <select
                  value={complaint.category}
                  onChange={(e) => setComplaint((c) => ({ ...c, category: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PRODUCT_QUALITY">Product Quality</option>
                  <option value="DELIVERY">Delivery Issue</option>
                  <option value="PAYMENT">Payment Issue</option>
                  <option value="FRAUD">Fraud / Scam</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  maxLength={200}
                  value={complaint.subject}
                  onChange={(e) => setComplaint((c) => ({ ...c, subject: e.target.value }))}
                  placeholder="Brief summary of the issue"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={complaint.description}
                  onChange={(e) => setComplaint((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Describe the issue in detail (min 20 characters)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowComplaint(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRaiseRequest}
                  disabled={complaintLoading}
                  className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {complaintLoading ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
