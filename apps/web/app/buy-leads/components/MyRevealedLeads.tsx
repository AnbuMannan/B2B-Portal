'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Phone, Mail, MessageCircle, Download, Search, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import type { RevealedContact } from '../BuyLeadsClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface RevealedLeadsResponse {
  reveals: RevealedContact[];
  total: number;
  page: number;
  totalPages: number;
}

interface MyRevealedLeadsProps {
  accessToken?: string;
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
}

export function MyRevealedLeads({ accessToken }: MyRevealedLeadsProps) {
  const [reveals, setReveals] = useState<RevealedContact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  useEffect(() => {
    fetchReveals(1, true);
  }, [fetchReveals]);

  // ── CSV export ────────────────────────────────────────────────────────────

  const exportCsv = () => {
    if (reveals.length === 0) return;

    const headers = [
      'Product Name', 'Quantity', 'Unit', 'Country',
      'Phone', 'Email', 'WhatsApp', 'GSTIN', 'Revealed At',
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
    <div>
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
                className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Lead info */}
                  <div>
                    <p className="font-semibold text-gray-900">{r.lead?.productName ?? 'Unknown Product'}</p>
                    <p className="text-sm text-gray-500">
                      {r.lead?.quantity != null ? `${r.lead.quantity} ${r.lead.unit ?? ''}` : ''}
                      {r.lead?.expectedCountry ? ` · ${r.lead.expectedCountry}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Revealed {format(new Date(r.revealedAt), 'dd MMM yyyy, HH:mm')}
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
