/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type Negotiation = {
  id: string;
  fromRole: 'BUYER' | 'SELLER';
  counterPrice: number | null;
  message: string;
  createdAt: string;
};

type QuoteDetail = {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  quotedPrice: number;
  leadTime: string | null;
  notes: string | null;
  createdAt: string;
  expiresAt: string | null;
  negotiationCount: number;
  product: { id: string; name: string } | null;
  seller: {
    id: string;
    companyName: string;
    isVerified: boolean;
    industryType: string | null;
    location: string | null;
    logoUrl: string | null;
    badges: string[];
  };
  requirement: {
    id: string;
    productName: string;
    quantity: number | null;
    unit: string | null;
    targetPriceMin: number | null;
    targetPriceMax: number | null;
    currency: string;
    expiryDate: string | null;
  } | null;
  order: {
    id: string;
    status: string;
    finalPrice: number | null;
    platformFacilitationFee: number | null;
  };
  negotiations: Negotiation[];
};

const STATUS_STYLES: Record<QuoteDetail['status'], string> = {
  PENDING: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-gray-200 text-gray-600',
};

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = String((params as any)?.quoteId ?? '');

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showNegotiate, setShowNegotiate] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [negoMessage, setNegoMessage] = useState('');
  const [negoErr, setNegoErr] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const withAuth = useCallback(() => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;
    if (!token) {
      router.push('/auth/signin');
      return null;
    }
    return { headers: { Authorization: `Bearer ${token}` } };
  }, [router]);

  const load = useCallback(async () => {
    const cfg = withAuth();
    if (!cfg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/buyer/quotes/${quoteId}`, cfg);
      setQuote(res.data?.data ?? res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('Quote not found.');
      } else if (err?.response?.status === 401) {
        router.push('/auth/signin');
      } else {
        setError(err?.response?.data?.message ?? 'Failed to load quote.');
      }
    } finally {
      setLoading(false);
    }
  }, [quoteId, router, withAuth]);

  useEffect(() => {
    if (quoteId) load();
  }, [quoteId, load]);

  const onAccept = async () => {
    if (!confirm('Accept this quote? Other quotes for this requirement will be auto-rejected.')) return;
    const cfg = withAuth();
    if (!cfg) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API_URL}/api/buyer/quotes/${quoteId}/accept`, {}, cfg);
      const data = res.data?.data ?? res.data;
      flash(`Quote accepted. Order ${data.orderId} created.`);
      load();
    } catch (err: any) {
      flash(err?.response?.data?.message ?? 'Failed to accept');
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!confirm('Reject this quote?')) return;
    const cfg = withAuth();
    if (!cfg) return;
    setBusy(true);
    try {
      await axios.post(`${API_URL}/api/buyer/quotes/${quoteId}/reject`, {}, cfg);
      flash('Quote rejected');
      load();
    } catch (err: any) {
      flash(err?.response?.data?.message ?? 'Failed to reject');
    } finally {
      setBusy(false);
    }
  };

  const sendNegotiate = async () => {
    setNegoErr(null);
    const price = Number(counterPrice);
    if (!price || price <= 0) {
      setNegoErr('Enter a valid counter-price');
      return;
    }
    const cfg = withAuth();
    if (!cfg) return;
    setBusy(true);
    try {
      await axios.post(
        `${API_URL}/api/buyer/quotes/${quoteId}/negotiate`,
        { counterPrice: price, message: negoMessage },
        cfg,
      );
      setShowNegotiate(false);
      setCounterPrice('');
      setNegoMessage('');
      flash('Counter-offer sent');
      load();
    } catch (err: any) {
      setNegoErr(err?.response?.data?.message ?? 'Failed to send');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading quote…</div>
    );
  }

  if (error || !quote) {
    return (
      <div className="p-8">
        <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <p className="font-semibold">{error ?? 'Quote not found'}</p>
          <Link
            href="/buyer/quotes"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline"
          >
            ← Back to quotes
          </Link>
        </div>
      </div>
    );
  }

  const isPending = quote.status === 'PENDING';
  const priceDelta = quote.requirement?.targetPriceMax
    ? Math.round(((quote.quotedPrice - quote.requirement.targetPriceMax) / quote.requirement.targetPriceMax) * 100)
    : null;

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/buyer/quotes"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to quotes
        </Link>

        {toast && (
          <div className="mb-4 rounded-lg bg-gray-900 text-white text-sm px-4 py-2 inline-block">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quote header */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-gray-900">
                      Quote from {quote.seller.companyName}
                    </h1>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_STYLES[quote.status]}`}>
                      {quote.status}
                    </span>
                  </div>
                  {quote.requirement && (
                    <p className="text-sm text-gray-500 mt-1">
                      For requirement: <span className="text-gray-700 font-medium">{quote.requirement.productName}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">
                    ₹{quote.quotedPrice.toLocaleString('en-IN')}
                  </p>
                  {priceDelta != null && (
                    <p className={`text-xs mt-1 font-medium ${priceDelta <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {priceDelta <= 0 ? '' : '+'}
                      {priceDelta}% vs target max
                    </p>
                  )}
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {quote.product && (
                  <div>
                    <dt className="text-gray-500 text-xs">Product</dt>
                    <dd className="text-gray-900 font-medium">{quote.product.name}</dd>
                  </div>
                )}
                {quote.leadTime && (
                  <div>
                    <dt className="text-gray-500 text-xs">Lead time</dt>
                    <dd className="text-gray-900 font-medium">{quote.leadTime}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 text-xs">Received</dt>
                  <dd className="text-gray-900 font-medium">
                    {new Date(quote.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </dd>
                </div>
                {quote.expiresAt && (
                  <div>
                    <dt className="text-gray-500 text-xs">Expires</dt>
                    <dd className="text-gray-900 font-medium">
                      {new Date(quote.expiresAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </dd>
                  </div>
                )}
              </dl>

              {quote.notes && (
                <div className="mt-5 pt-5 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Seller notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}

              {isPending && (
                <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={onAccept}
                    disabled={busy}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Accept quote
                  </button>
                  <button
                    onClick={() => setShowNegotiate(true)}
                    disabled={busy}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Negotiate
                  </button>
                  <button
                    onClick={onReject}
                    disabled={busy}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}

              {quote.status === 'ACCEPTED' && quote.order.finalPrice != null && (
                <div className="mt-6 pt-5 border-t border-gray-100 rounded-lg bg-emerald-50 border-emerald-100 p-4">
                  <p className="text-sm font-semibold text-emerald-800">
                    Order finalized — ₹{quote.order.finalPrice.toLocaleString('en-IN')}
                  </p>
                  {quote.order.platformFacilitationFee != null && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Platform facilitation fee: ₹{quote.order.platformFacilitationFee.toLocaleString('en-IN')} (15%)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Negotiation thread */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Negotiation history</h2>
              {quote.negotiations.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No counter-offers yet. {isPending && 'Use Negotiate to send one.'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {quote.negotiations.map((n) => (
                    <li
                      key={n.id}
                      className={`flex ${n.fromRole === 'BUYER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          n.fromRole === 'BUYER'
                            ? 'bg-blue-50 border border-blue-100'
                            : 'bg-gray-50 border border-gray-100'
                        }`}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            {n.fromRole === 'BUYER' ? 'You' : 'Seller'}
                          </span>
                          {n.counterPrice != null && (
                            <span className="text-sm font-bold text-gray-900">
                              ₹{n.counterPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        {n.message && (
                          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{n.message}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-2">
                          {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Side column: seller + requirement */}
          <aside className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Seller
              </h3>
              <div className="flex items-start gap-3">
                {quote.seller.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={quote.seller.logoUrl}
                    alt={quote.seller.companyName}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0">
                    {quote.seller.companyName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{quote.seller.companyName}</p>
                  {quote.seller.location && (
                    <p className="text-xs text-gray-500">{quote.seller.location}</p>
                  )}
                  {quote.seller.industryType && (
                    <p className="text-xs text-gray-500">{quote.seller.industryType}</p>
                  )}
                </div>
              </div>
              {quote.seller.badges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {quote.seller.badges.map((b) => (
                    <span
                      key={b}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 uppercase tracking-wide"
                    >
                      {b.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              )}
              <Link
                href={`/sellers/${quote.seller.id}`}
                className="mt-4 inline-block text-xs font-semibold text-blue-600 hover:underline"
              >
                View seller profile →
              </Link>
            </div>

            {quote.requirement && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Your requirement
                </h3>
                <p className="font-semibold text-gray-900">{quote.requirement.productName}</p>
                <dl className="mt-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Quantity</dt>
                    <dd className="text-gray-900 font-medium">
                      {quote.requirement.quantity ?? '—'} {quote.requirement.unit ?? ''}
                    </dd>
                  </div>
                  {(quote.requirement.targetPriceMin != null ||
                    quote.requirement.targetPriceMax != null) && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Target price</dt>
                      <dd className="text-gray-900 font-medium">
                        {quote.requirement.targetPriceMin != null &&
                        quote.requirement.targetPriceMax != null
                          ? `₹${quote.requirement.targetPriceMin} – ₹${quote.requirement.targetPriceMax}`
                          : `₹${quote.requirement.targetPriceMin ?? quote.requirement.targetPriceMax}`}
                      </dd>
                    </div>
                  )}
                  {quote.requirement.expiryDate && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Expires</dt>
                      <dd className="text-gray-900 font-medium">
                        {new Date(quote.requirement.expiryDate).toLocaleDateString('en-IN')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Negotiate modal */}
      {showNegotiate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowNegotiate(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Send counter-offer</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Current quote ₹{quote.quotedPrice.toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setShowNegotiate(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Your counter-price (₹)
            </label>
            <input
              type="number"
              min="0"
              value={counterPrice}
              onChange={(e) => setCounterPrice(e.target.value)}
              placeholder="e.g. 180"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
            />

            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Message (optional)
            </label>
            <textarea
              rows={3}
              value={negoMessage}
              onChange={(e) => setNegoMessage(e.target.value)}
              placeholder="Why you're asking for this price…"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />

            {negoErr && <p className="mt-3 text-sm text-red-600">{negoErr}</p>}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setShowNegotiate(false)}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={sendNegotiate}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send Counter-Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
