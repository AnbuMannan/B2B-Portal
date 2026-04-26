'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Phone, Mail, MessageCircle, Download, Search, Copy,
  TrendingUp, CheckCircle2, SendHorizonal, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { RevealedContact } from '../BuyLeadsClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface RevealedLeadsResponse {
  reveals: RevealedContact[];
  total: number;
  page: number;
  totalPages: number;
}

interface ConversionRate {
  totalReveals: number;
  converted: number;
  conversionRate: number;
}

interface MyRevealedLeadsProps {
  accessToken?: string;
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
}

interface QuoteForm {
  quotedPrice: string;
  leadTime: string;
  notes: string;
  validDays: string;
}

const QUOTE_INIT: QuoteForm = { quotedPrice: '', leadTime: '', notes: '', validDays: '7' };

export function MyRevealedLeads({ accessToken }: MyRevealedLeadsProps) {
  const [reveals, setReveals] = useState<RevealedContact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [conversionRate, setConversionRate] = useState<ConversionRate | null>(null);
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());

  // Quote modal state
  const [quoteTarget, setQuoteTarget] = useState<RevealedContact | null>(null);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(QUOTE_INIT);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  // Track which leads already have a quote submitted this session
  const [quotedLeadIds, setQuotedLeadIds] = useState<Set<string>>(new Set());

  const fetchReveals = useCallback(
    async (pageNum = 1, reset = false) => {
      if (!accessToken) return;
      setIsLoading(true);

      const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
      if (search) params.set('productName', search);

      try {
        const res = await fetch(`${API_BASE}/api/buy-leads/my-revealed?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? 'Failed to load');

        const data: RevealedLeadsResponse = json.data;
        setReveals(reset ? data.reveals : (prev) => [...prev, ...data.reveals]);
        setTotal(data.total);
        setPage(pageNum);
        setTotalPages(data.totalPages);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load revealed leads');
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, search],
  );

  const fetchConversionRate = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/seller/leads/conversion-rate`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (res.ok) setConversionRate(json.data);
    } catch { /* non-critical */ }
  }, [accessToken]);

  useEffect(() => {
    fetchReveals(1, true);
    fetchConversionRate();
  }, [fetchReveals, fetchConversionRate]);

  // ── Mark as Converted ─────────────────────────────────────────────────────

  const handleMarkConverted = async (reveal: RevealedContact) => {
    if (!accessToken || convertingIds.has(reveal.id)) return;

    setConvertingIds((prev) => new Set([...Array.from(prev), reveal.id]));

    try {
      const res = await fetch(`${API_BASE}/api/seller/leads/${reveal.buyLeadId}/convert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to mark converted');

      if (json.data?.alreadyMarked) {
        toast('Already marked as converted');
      } else {
        toast.success('Marked as converted!');
        // Update local state
        setReveals((prev) =>
          prev.map((r) =>
            r.id === reveal.id ? { ...r, convertedToOrder: true, convertedAt: new Date().toISOString() } : r
          )
        );
        // Refresh conversion rate
        fetchConversionRate();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark converted');
    } finally {
      setConvertingIds((prev) => { const s = new Set(prev); s.delete(reveal.id); return s; });
    }
  };

  // ── Submit quote ──────────────────────────────────────────────────────────

  const handleSubmitQuote = async () => {
    if (!accessToken || !quoteTarget) return;
    const price = Number(quoteForm.quotedPrice);
    if (!price || price <= 0) { toast.error('Enter a valid price'); return; }

    setSubmittingQuote(true);
    try {
      const res = await fetch(`${API_BASE}/api/seller/leads/${quoteTarget.buyLeadId}/quote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotedPrice: price,
          leadTime: quoteForm.leadTime || undefined,
          notes: quoteForm.notes || undefined,
          validDays: Number(quoteForm.validDays) || 7,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to submit quote');
      toast.success('Quote sent to buyer!');
      setQuotedLeadIds((prev) => new Set([...Array.from(prev), quoteTarget.buyLeadId]));
      setQuoteTarget(null);
      setQuoteForm(QUOTE_INIT);
      fetchConversionRate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit quote');
    } finally {
      setSubmittingQuote(false);
    }
  };

  // ── CSV export ────────────────────────────────────────────────────────────

  const exportCsv = () => {
    if (reveals.length === 0) return;

    const headers = [
      'Product Name', 'Quantity', 'Unit', 'Country',
      'Phone', 'Email', 'WhatsApp', 'GSTIN', 'Revealed At', 'Converted',
    ];

    const rows = reveals.map((r) => [
      r.lead?.productName ?? '',
      r.lead?.quantity ?? '',
      r.lead?.unit ?? '',
      r.lead?.expectedCountry ?? '',
      r.buyerPhoneNumber,
      r.buyerEmail,
      r.buyerWhatsapp,
      r.buyerGstin ?? '',
      format(new Date(r.revealedAt), 'dd/MM/yyyy HH:mm'),
      r.convertedToOrder ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revealed-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      {/* Conversion rate stat */}
      {conversionRate && conversionRate.totalReveals > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-green-50 border border-green-100 p-4">
          <TrendingUp className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              {conversionRate.conversionRate}% conversion rate
            </p>
            <p className="text-xs text-green-600">
              {conversionRate.converted} of {conversionRate.totalReveals} revealed leads converted to orders
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchReveals(1, true)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={reveals.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {isLoading && reveals.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : reveals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-lg font-semibold text-gray-700">No revealed leads yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Reveal a buy lead contact to see it here.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-500">{total} revealed lead{total !== 1 ? 's' : ''}</p>

          <div className="space-y-3">
            {reveals.map((r) => (
              <div
                key={r.id}
                className={`rounded-xl bg-white p-5 shadow-sm ring-1 transition-colors ${
                  r.convertedToOrder ? 'ring-green-200 bg-green-50/30' : 'ring-gray-200'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Lead info */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{r.lead?.productName ?? 'Unknown Product'}</p>
                      {r.convertedToOrder && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Converted
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {r.lead?.quantity != null ? `${r.lead.quantity} ${r.lead.unit ?? ''}` : ''}
                      {r.lead?.expectedCountry ? ` · ${r.lead.expectedCountry}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Revealed {format(new Date(r.revealedAt), 'dd MMM yyyy, HH:mm')}
                      {r.convertedAt && (
                        <> · Converted {format(new Date(r.convertedAt), 'dd MMM yyyy')}</>
                      )}
                    </p>
                  </div>

                  {/* Contact details */}
                  <div className="flex flex-wrap gap-2">
                    {r.buyerPhoneNumber && (
                      <ContactChip
                        icon={<Phone className="h-3.5 w-3.5" />}
                        label={r.buyerPhoneNumber}
                        onCopy={() => copy(r.buyerPhoneNumber)}
                      />
                    )}
                    {r.buyerEmail && (
                      <ContactChip
                        icon={<Mail className="h-3.5 w-3.5" />}
                        label={r.buyerEmail}
                        onCopy={() => copy(r.buyerEmail)}
                      />
                    )}
                    {r.buyerWhatsapp && r.buyerWhatsapp !== r.buyerPhoneNumber && (
                      <ContactChip
                        icon={<MessageCircle className="h-3.5 w-3.5 text-green-600" />}
                        label={r.buyerWhatsapp}
                        onCopy={() => copy(r.buyerWhatsapp)}
                      />
                    )}
                  </div>
                </div>

                {r.buyerGstin && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="font-medium">GSTIN:</span>
                    <span className="font-mono">{r.buyerGstin}</span>
                    <button onClick={() => copy(r.buyerGstin!)} className="text-gray-400 hover:text-gray-600">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 border-t border-gray-100 pt-3 flex items-center gap-4 flex-wrap">
                  {quotedLeadIds.has(r.buyLeadId) ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-blue-600">
                      <SendHorizonal className="h-4 w-4" />
                      Quote sent
                    </span>
                  ) : (
                    <button
                      onClick={() => { setQuoteTarget(r); setQuoteForm(QUOTE_INIT); }}
                      className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <SendHorizonal className="h-4 w-4" />
                      Send Quote
                    </button>
                  )}
                  {!r.convertedToOrder && (
                    <button
                      onClick={() => handleMarkConverted(r)}
                      disabled={convertingIds.has(r.id)}
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {convertingIds.has(r.id) ? 'Saving...' : 'Mark as Converted'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {page < totalPages && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => fetchReveals(page + 1)}
                disabled={isLoading}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Quote modal */}
      {quoteTarget && (
        <QuoteModal
          reveal={quoteTarget}
          form={quoteForm}
          onChange={setQuoteForm}
          onSubmit={handleSubmitQuote}
          onClose={() => { setQuoteTarget(null); setQuoteForm(QUOTE_INIT); }}
          submitting={submittingQuote}
        />
      )}
    </div>
  );
}

function QuoteModal({
  reveal,
  form,
  onChange,
  onSubmit,
  onClose,
  submitting,
}: {
  reveal: RevealedContact;
  form: QuoteForm;
  onChange: (f: QuoteForm) => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Send Quote</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-[280px] truncate">
              {reveal.lead?.productName ?? 'Buy Lead'}
              {reveal.lead?.quantity ? ` · ${reveal.lead.quantity} ${reveal.lead.unit ?? ''}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Your price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={form.quotedPrice}
              onChange={(e) => onChange({ ...form, quotedPrice: e.target.value })}
              placeholder="e.g. 15000"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Lead time</label>
            <input
              type="text"
              value={form.leadTime}
              onChange={(e) => onChange({ ...form, leadTime: e.target.value })}
              placeholder="e.g. 5–7 business days"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              placeholder="Include GST details, packaging, delivery terms…"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Quote valid for (days)</label>
            <select
              value={form.validDays}
              onChange={(e) => onChange({ ...form, validDays: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {[3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <SendHorizonal className="h-4 w-4" />
              {submitting ? 'Sending…' : 'Send Quote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactChip({
  icon,
  label,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
      {icon}
      <span className="max-w-[160px] truncate">{label}</span>
      <button onClick={onCopy} className="text-gray-400 hover:text-gray-600 ml-1">
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}
