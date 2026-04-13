'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeadCard } from './LeadCard';
import type { BuyLead } from '../BuyLeadsClient';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface SavedLeadsProps {
  accessToken?: string;
  revealedLeadIds: Set<string>;
  savedLeadIds: Set<string>;
  onReveal: (lead: BuyLead) => void;
  onToggleSave: (lead: BuyLead) => void;
}

interface SavedLeadsResponse {
  leads: BuyLead[];
  total: number;
  page: number;
  totalPages: number;
}

export function SavedLeads({
  accessToken,
  revealedLeadIds,
  savedLeadIds,
  onReveal,
  onToggleSave,
}: SavedLeadsProps) {
  const [leads, setLeads] = useState<BuyLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSaved = useCallback(
    async (pageNum = 1, reset = false) => {
      if (!accessToken) return;
      setIsLoading(true);

      const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
      try {
        const res = await fetch(`${API_BASE}/api/seller/leads/saved?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? 'Failed to load saved leads');

        const data: SavedLeadsResponse = json.data;
        setLeads(reset ? data.leads : (prev) => [...prev, ...data.leads]);
        setTotal(data.total);
        setPage(pageNum);
        setTotalPages(data.totalPages);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load saved leads');
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    fetchSaved(1, true);
  }, [fetchSaved]);

  // Remove lead from local list when unsaved
  const handleToggleSave = (lead: BuyLead) => {
    onToggleSave(lead);
    // Optimistically remove from list if unsaving
    if (savedLeadIds.has(lead.id)) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setTotal((t) => Math.max(0, t - 1));
    }
  };

  if (isLoading && leads.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
        <p className="text-lg font-semibold text-gray-700">No saved leads</p>
        <p className="mt-1 text-sm text-gray-400">
          Bookmark leads using the save icon to track them here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        {total} saved lead{total !== 1 ? 's' : ''}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            isRevealed={revealedLeadIds.has(lead.id)}
            isMatched={lead.isMatched}
            isSaved={savedLeadIds.has(lead.id)}
            onReveal={() => onReveal(lead)}
            onToggleSave={() => handleToggleSave(lead)}
            accessToken={accessToken}
          />
        ))}
      </div>

      {page < totalPages && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => fetchSaved(page + 1)}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Loading...' : `Load More (${total - leads.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
