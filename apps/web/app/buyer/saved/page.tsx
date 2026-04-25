/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export default function SavedItemsPage() {
  const router = useRouter();
  const [data, setData] = useState<{ sellers: any[]; products: any[] }>({ sellers: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sellers' | 'products'>('sellers');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin?returnUrl=/buyer/saved'); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/buyer/saved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data?.data ?? { sellers: [], products: [] });
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 401 || s === 403) router.push('/auth/signin');
      else setError(err?.response?.data?.message ?? 'Failed to load saved items');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const unsaveSeller = async (sellerId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      await axios.post(`${API_URL}/api/buyer/save/seller/${sellerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData((prev) => ({
        ...prev,
        sellers: prev.sellers.filter((s) => s.id !== sellerId),
      }));
      showToast('Seller removed from saved list');
    } catch {
      showToast('Failed to remove seller');
    }
  };

  const unsaveProduct = async (productId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      await axios.post(`${API_URL}/api/buyer/save/product/${productId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
      }));
      showToast('Product removed from saved list');
    } catch {
      showToast('Failed to remove product');
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Saved Items</h1>
        <p className="text-sm text-gray-500 mt-0.5">Sellers and products you&apos;ve bookmarked</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-5 border-b border-gray-200">
        <div className="flex gap-1">
          {(['sellers', 'products'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'sellers' ? `Sellers (${data.sellers.length})` : `Products (${data.products.length})`}
            </button>
          ))}
        </div>
        <Link
          href={tab === 'sellers' ? '/buyer/browse/sellers' : '/buyer/browse/products'}
          className="mb-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition"
        >
          + Browse {tab === 'sellers' ? 'Sellers' : 'Products'}
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-5 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : tab === 'sellers' ? (
        data.sellers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm mb-3">No saved sellers yet.</p>
            <Link href="/buyer/browse/sellers" className="text-sm text-blue-600 hover:underline font-medium">
              Browse sellers →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.sellers.map((seller) => (
              <div key={seller.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-sm transition group">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{seller.companyName}</p>
                    {seller.city && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[seller.city, seller.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => unsaveSeller(seller.id)}
                    className="text-gray-300 hover:text-red-500 transition flex-shrink-0"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v1h2a1 1 0 110 2h-1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8H3a1 1 0 110-2h2V5zm2 0v1h6V5H7zm-1 4v7h8V9H6z" />
                    </svg>
                  </button>
                </div>
                {seller.isVerified && (
                  <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mb-3">
                    Verified
                  </span>
                )}
                <div className="flex gap-2">
                  <Link
                    href={`/seller/${seller.id}`}
                    className="flex-1 text-center text-xs font-semibold px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-700"
                  >
                    View Profile
                  </Link>
                  <Link
                    href={`/buyer/requirements/new?sellerId=${seller.id}`}
                    className="flex-1 text-center text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Get Quote
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        data.products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm mb-3">No saved products yet.</p>
            <Link href="/buyer/browse/products" className="text-sm text-blue-600 hover:underline font-medium">
              Browse products →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900 truncate flex-1">{product.name}</p>
                  <button
                    onClick={() => unsaveProduct(product.id)}
                    className="text-gray-300 hover:text-red-500 transition flex-shrink-0"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v1h2a1 1 0 110 2h-1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8H3a1 1 0 110-2h2V5zm2 0v1h6V5H7zm-1 4v7h8V9H6z" />
                    </svg>
                  </button>
                </div>
                {product.seller && (
                  <p className="text-xs text-gray-500 mb-3">by {product.seller.companyName}</p>
                )}
                <Link
                  href={`/products/${product.id}`}
                  className="block text-center text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  View Product
                </Link>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
