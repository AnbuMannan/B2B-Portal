/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

type QuoteSummary = {
  id: string;
  status: QuoteStatus;
  quotedPrice: number;
  leadTime: string | null;
  notes: string | null;
  createdAt: string;
  expiresAt: string | null;
  negotiationCount: number;
  orderId: string;
  orderStatus: string | null;
  product: { id: string; name: string } | null;
  seller: {
    id: string;
    companyName: string;
    isVerified: boolean;
    logoUrl: string | null;
    location: string | null;
    badges: string[];
  };
};

type Group = {
  requirement: {
    id: string | null;
    productName: string;
    expiryDate: string | null;
  };
  quoteCount: number;
  quotes: QuoteSummary[];
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  PENDING: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-gray-200 text-gray-600',
};

function QuoteCard({
  quote,
  onAccept,
  onReject,
  onNegotiate,
  busy,
  highlightLowest,
}: {
  quote: QuoteSummary;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onNegotiate: (id: string) => void;
  busy: boolean;
  highlightLowest: boolean;
}) {
  const isPending = quote.status === 'PENDING';
  return (
    <div
      className={`relative bg-white rounded-xl border p-4 ${
        highlightLowest ? 'border-emerald-300 shadow-sm' : 'border-gray-100'
      }`}
    >
      {highlightLowest && (
        <span className="absolute -top-2 left-3 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white uppercase tracking-wide">
          Lowest price
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {quote.seller.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={quote.seller.logoUrl}
              alt={quote.seller.companyName}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0">
              {quote.seller.companyName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/buyer/quotes/${quote.id}`}
                className="font-semibold text-gray-900 hover:text-blue-600 truncate"
              >
                {quote.seller.companyName}
              </Link>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_STYLES[quote.status]}`}
              >
                {quote.status}
              </span>
            </div>
            {quote.seller.badges.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
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
            {quote.seller.location && (
              <p className="text-xs text-gray-500 mt-1">{quote.seller.location}</p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-gray-900">
            ₹{quote.quotedPrice.toLocaleString('en-IN')}
          </p>
          {quote.leadTime && (
            <p className="text-xs text-gray-500 mt-1">
              Lead time: {quote.leadTime}
            </p>
          )}
        </div>
      </div>

      {quote.notes && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{quote.notes}</p>
      )}

      {quote.negotiationCount > 0 && (
        <p className="mt-2 text-xs text-amber-700 font-medium">
          {quote.negotiationCount} negotiation{quote.negotiationCount === 1 ? '' : 's'}
        </p>
      )}

      {isPending && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onAccept(quote.id)}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => onNegotiate(quote.id)}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            Negotiate
          </button>
          <button
            onClick={() => onReject(quote.id)}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Reject
          </button>
          <Link
            href={`/buyer/quotes/${quote.id}`}
            className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-md text-blue-600 hover:bg-blue-50"
          >
            View details →
          </Link>
        </div>
      )}
      {!isPending && (
        <div className="mt-4 flex justify-end">
          <Link
            href={`/buyer/quotes/${quote.id}`}
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-blue-600 hover:bg-blue-50"
          >
            View details →
          </Link>
        </div>
      )}
    </div>
  );
}

function NegotiateModal({
  quoteId,
  currentPrice,
  onClose,
  onSent,
}: {
  quoteId: string;
  currentPrice: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [counterPrice, setCounterPrice] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setErr(null);
    const price = Number(counterPrice);
    if (!price || price <= 0) {
      setErr('Enter a valid counter-price');
      return;
    }
    setSending(true);
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(
        `${API_URL}/api/buyer/quotes/${quoteId}/negotiate`,
        { counterPrice: price, message },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      onSent();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to send counter-offer');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Send counter-offer</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Seller quoted ₹{currentPrice.toLocaleString('en-IN')}
            </p>
          </div>
          <button
            onClick={onClose}
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
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Why you're asking for this price…"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />

        {err && (
          <p className="mt-3 text-sm text-red-600">{err}</p>
        )}

        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send Counter-Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BuyerQuotesPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [negotiatingQuote, setNegotiatingQuote] = useState<QuoteSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/signin');
        return;
      }
      const res = await axios.get(`${API_URL}/api/buyer/quotes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = res.data?.data ?? res.data;
      const list: Group[] = payload?.groups ?? [];
      setGroups(list);
      // Auto-expand the first requirement so the page isn't empty-looking
      setExpanded((prev) => {
        const next = { ...prev };
        list.slice(0, 1).forEach((g) => {
          if (g.requirement.id) next[g.requirement.id] = true;
        });
        return next;
      });
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push('/auth/signin');
        return;
      }
      if (err?.response?.status === 403) {
        router.push('/buyer/register');
        return;
      }
      setError(err?.response?.data?.message ?? 'Failed to load quotes.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const withAuth = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/auth/signin');
      return null;
    }
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const onAccept = async (quoteId: string) => {
    if (!confirm('Accept this quote? Other quotes for this requirement will be auto-rejected.')) {
      return;
    }
    const cfg = withAuth();
    if (!cfg) return;
    setBusyId(quoteId);
    try {
      const res = await axios.post(
        `${API_URL}/api/buyer/quotes/${quoteId}/accept`,
        {},
        cfg,
      );
      const data = res.data?.data ?? res.data;
      flash(
        `Quote accepted. Order ${data.orderId} created — fee ₹${(data.platformFacilitationFee ?? 0).toLocaleString('en-IN')}.`,
      );
      load();
    } catch (err: any) {
      flash(err?.response?.data?.message ?? 'Failed to accept quote');
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (quoteId: string) => {
    if (!confirm('Reject this quote?')) return;
    const cfg = withAuth();
    if (!cfg) return;
    setBusyId(quoteId);
    try {
      await axios.post(`${API_URL}/api/buyer/quotes/${quoteId}/reject`, {}, cfg);
      flash('Quote rejected');
      load();
    } catch (err: any) {
      flash(err?.response?.data?.message ?? 'Failed to reject quote');
    } finally {
      setBusyId(null);
    }
  };

  const onNegotiate = (quoteId: string) => {
    const quote = groups
      .flatMap((g) => g.quotes)
      .find((q) => q.id === quoteId);
    if (quote) setNegotiatingQuote(quote);
  };

  const totalQuotes = useMemo(
    () => groups.reduce((sum, g) => sum + g.quoteCount, 0),
    [groups],
  );

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotes Received</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalQuotes === 0
                ? 'No quotes yet — sellers will respond to your requirements shortly.'
                : `${totalQuotes} quote${totalQuotes === 1 ? '' : 's'} across ${groups.length} requirement${groups.length === 1 ? '' : 's'}.`}
            </p>
          </div>
          <Link
            href="/buyer/requirements/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            + Post New Requirement
          </Link>
        </div>

        {toast && (
          <div className="mb-4 rounded-lg bg-gray-900 text-white text-sm px-4 py-2 inline-block">
            {toast}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-gray-100">
            Loading quotes…
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <h2 className="font-semibold text-gray-900">No quotes yet</h2>
            <p className="text-sm text-gray-500 mt-1">
              Post a requirement to start receiving quotes from verified sellers.
            </p>
            <Link
              href="/buyer/requirements/new"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              Post Requirement
            </Link>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="space-y-4">
            {groups.map((group) => {
              const key = group.requirement.id ?? '__unassigned__';
              const isOpen = !!expanded[key];
              const minPrice = Math.min(
                ...group.quotes
                  .filter((q) => q.status !== 'REJECTED')
                  .map((q) => q.quotedPrice),
              );
              return (
                <div
                  key={key}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [key]: !isOpen }))
                    }
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                  >
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {group.requirement.productName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {group.quoteCount} {group.quoteCount === 1 ? 'seller quoted' : 'sellers quoted'}
                      </p>
                    </div>
                    {group.requirement.id && (
                      <Link
                        href={`/buyer/requirements`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View requirement
                      </Link>
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                      {group.quotes.length >= 2 && (
                        <p className="text-xs text-gray-500">
                          Compare {group.quotes.length} quotes below. Lowest price is highlighted.
                        </p>
                      )}
                      <div
                        className={
                          group.quotes.length >= 2
                            ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
                            : 'space-y-3'
                        }
                      >
                        {group.quotes.map((q) => (
                          <QuoteCard
                            key={q.id}
                            quote={q}
                            busy={busyId === q.id}
                            highlightLowest={
                              group.quotes.length >= 2 &&
                              q.status !== 'REJECTED' &&
                              q.quotedPrice === minPrice
                            }
                            onAccept={onAccept}
                            onReject={onReject}
                            onNegotiate={onNegotiate}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {negotiatingQuote && (
        <NegotiateModal
          quoteId={negotiatingQuote.id}
          currentPrice={negotiatingQuote.quotedPrice}
          onClose={() => setNegotiatingQuote(null)}
          onSent={() => {
            setNegotiatingQuote(null);
            flash('Counter-offer sent');
            load();
          }}
        />
      )}
    </div>
  );
}
