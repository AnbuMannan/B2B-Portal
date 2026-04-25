'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import axios from 'axios';
import Header from '@/components/homepage/Header';
import Footer from '@/components/homepage/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface SellerListItem {
  id: string;
  companyName: string;
  city: string | null;
  state: string | null;
  companyInitials: string;
  badges: string[];
  productCount: number;
  yearsInBusiness: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const BADGE_CONFIG: Record<string, { label: string; classes: string }> = {
  VERIFIED_SELLER: { label: '✓ Verified Seller', classes: 'bg-green-100 text-green-800' },
  GST_VERIFIED: { label: '✓ GST Verified', classes: 'bg-green-100 text-green-800' },
  IEC_GLOBAL: { label: '✓ IEC Global', classes: 'bg-blue-100 text-blue-800' },
};

function SellerCard({
  seller,
  isSaved,
  onToggleSave,
}: {
  seller: SellerListItem;
  isSaved: boolean;
  onToggleSave: (sellerId: string) => void;
}) {
  const location = seller.city && seller.state
    ? `${seller.city}, ${seller.state}`
    : seller.state ?? seller.city ?? null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg">
          {seller.companyInitials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base text-gray-900 truncate">{seller.companyName}</h3>
          {location && (
            <p className="text-sm text-gray-500 mt-0.5">📍 {location}</p>
          )}
        </div>
        <button
          onClick={() => onToggleSave(seller.id)}
          title={isSaved ? 'Remove from saved' : 'Save seller'}
          className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${
            isSaved ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'
          }`}
        >
          <svg className="w-5 h-5" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      <div className="flex gap-0.5 mb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="text-yellow-400 text-sm">★</span>
        ))}
      </div>

      <p className="text-xs text-gray-500 mb-3">
        {seller.productCount} Products · {seller.yearsInBusiness}+ years
      </p>

      {seller.badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {seller.badges.map((badge) => {
            const config = BADGE_CONFIG[badge];
            if (!config) return null;
            return (
              <span key={badge} className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.classes}`}>
                {config.label}
              </span>
            );
          })}
        </div>
      )}

      <Link
        href={`/seller/${seller.id}`}
        className="block w-full text-center py-2 rounded-lg border border-blue-600 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
      >
        View Profile
      </Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 bg-gray-200 rounded" />
          <div className="h-4 w-1/2 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-32 bg-gray-200 rounded mb-4" />
      <div className="h-9 w-full bg-gray-200 rounded" />
    </div>
  );
}

export default function SellersPage() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    axios.get(`${API_URL}/api/buyer/saved`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const sellers: { id: string }[] = res.data?.data?.sellers ?? [];
        setSavedIds(new Set(sellers.map((s) => s.id)));
      })
      .catch(() => {});
  }, []);

  const handleToggleSave = async (sellerId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) { window.location.href = '/auth/signin?returnUrl=/sellers'; return; }
    try {
      const res = await axios.post(
        `${API_URL}/api/buyer/save/seller/${sellerId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const saved: boolean = res.data?.data?.saved ?? false;
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (saved) { next.add(sellerId); } else { next.delete(sellerId); }
        return next;
      });
      showToast(saved ? 'Seller saved to your list' : 'Seller removed from saved list');
    } catch {
      showToast('Failed to update saved list');
    }
  };

  const debounce = useCallback((value: string) => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    debounce(value);
  };

  const handleStateChange = (value: string) => {
    setState(value);
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['sellers-list', debouncedSearch, state, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (state) params.set('state', state);
      const res = await fetch(`/api/sellers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch sellers');
      const json = await res.json();
      return json.data as { data: SellerListItem[]; pagination: PaginationMeta };
    },
    placeholderData: (prev) => prev,
  });

  const sellers = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.pages ?? 1;
  const hasActiveFilter = !!(debouncedSearch || state);

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      <Header />

      {/* Page heading */}
      <div className="bg-white border-b border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Verified B2B Sellers in India
          </h1>
          <p className="text-gray-500 mt-1">
            Browse verified manufacturers, wholesalers and exporters
          </p>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-20 bg-white border-b border-gray-200 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by company name..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 min-w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={state}
            onChange={(e) => handleStateChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All States</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {hasActiveFilter && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); setState(''); setPage(1); }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Results count */}
        {pagination && (
          <p className="text-sm text-gray-500 mb-4">
            {pagination.total} seller{pagination.total !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : sellers.length > 0
              ? sellers.map((seller) => (
                  <SellerCard
                    key={seller.id}
                    seller={seller}
                    isSaved={savedIds.has(seller.id)}
                    onToggleSave={handleToggleSave}
                  />
                ))
              : (
                <div className="col-span-full text-center py-16 text-gray-500">
                  <p className="text-5xl mb-3">🔍</p>
                  <p className="font-medium">No verified sellers found.</p>
                  <p className="text-sm mt-1">Try different search terms.</p>
                </div>
              )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex justify-center items-center gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded text-sm font-medium transition-colors ${
                    p === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
