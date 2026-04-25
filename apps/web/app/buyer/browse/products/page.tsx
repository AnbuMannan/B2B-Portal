/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface ProductItem {
  id: string;
  name: string;
  image?: string;
  sellerCompanyName: string;
  pricingTiers: { tier: string; price: number; moq: number }[];
  availabilityStatus: string;
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
      <div className="h-32 bg-gray-200 rounded-lg mb-3" />
      <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-1/2 bg-gray-200 rounded mb-3" />
      <div className="h-8 w-full bg-gray-200 rounded" />
    </div>
  );
}

export default function BuyerBrowseProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const debounce = useCallback((value: string) => {
    const timeout = setTimeout(() => { setDebouncedSearch(value); setPage(1); }, 400);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    axios.get(`${API_URL}/api/buyer/saved`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const products: { id: string }[] = res.data?.data?.products ?? [];
        setSavedIds(new Set(products.map((p) => p.id)));
      })
      .catch(() => {});
  }, []);

  const handleToggleSave = async (productId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) { window.location.href = '/auth/signin?returnUrl=/buyer/browse/products'; return; }
    try {
      const res = await axios.post(
        `${API_URL}/api/buyer/save/product/${productId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const saved: boolean = res.data?.data?.saved ?? false;
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (saved) { next.add(productId); } else { next.delete(productId); }
        return next;
      });
      showToast(saved ? 'Product saved' : 'Product removed from saved list');
    } catch {
      showToast('Failed to update saved list');
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['buyer-browse-products', debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`${API_URL}/api/products?${params}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      return json.data as { data: ProductItem[]; pagination: { total: number; pages: number } };
    },
    placeholderData: (prev) => prev,
  });

  const products = data?.data ?? [];
  const totalPages = data?.pagination?.pages ?? 1;

  return (
    <div className="p-4 lg:p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Browse Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">Find and save products for future reference</p>
        </div>
        <Link href="/buyer/saved" className="text-sm text-blue-600 hover:underline font-medium">
          ← Back to Saved Items
        </Link>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); debounce(e.target.value); }}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {data?.pagination && (
        <p className="text-sm text-gray-500 mb-4">{data.pagination.total} products found</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : products.length === 0
            ? (
              <div className="col-span-full text-center py-16 text-gray-500">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-medium">No products found.</p>
              </div>
            )
            : products.map((product) => {
                const isSaved = savedIds.has(product.id);
                const lowestTier = product.pricingTiers?.[0];
                return (
                  <div key={product.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-36 bg-gray-100 flex items-center justify-center relative">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">📦</span>
                      )}
                      <button
                        onClick={() => handleToggleSave(product.id)}
                        title={isSaved ? 'Remove from saved' : 'Save product'}
                        className={`absolute top-2 right-2 p-1.5 rounded-full shadow transition-colors ${
                          isSaved ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:text-blue-500'
                        }`}
                      >
                        <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-gray-900 truncate mb-0.5">{product.name}</h3>
                      <p className="text-xs text-gray-500 mb-2">by {product.sellerCompanyName}</p>
                      {lowestTier && (
                        <p className="text-sm font-semibold text-blue-700 mb-3">
                          ₹{lowestTier.price.toLocaleString('en-IN')}
                          <span className="text-xs text-gray-400 font-normal ml-1">/ {lowestTier.tier}</span>
                        </p>
                      )}
                      <Link
                        href={`/product/${product.id}`}
                        className="block w-full text-center py-2 rounded-lg border border-blue-600 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
                      >
                        View Product
                      </Link>
                    </div>
                  </div>
                );
              })
        }
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-2">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded text-sm font-medium transition-colors ${
                p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
            className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
