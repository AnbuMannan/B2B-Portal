/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Product {
  id: string;
  name: string;
  images: string[];
  categories: { id: string; name: string }[];
  adminApprovalStatus: ApprovalStatus;
  availabilityStatus: 'IN_STOCK' | 'OUT_OF_STOCK';
  isActive: boolean;
  multiTierPricing: {
    retail?: { price: number; moq: number; enabled: boolean };
    wholesale?: { price: number; moq: number; enabled: boolean };
    bulk?: { price: number; moq: number; enabled: boolean };
  };
  viewCount: number;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_LABELS: Record<ApprovalStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
};

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'APPROVED', label: 'Active' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'REJECTED', label: 'Rejected' },
];

function getRetailPrice(pricing: Product['multiTierPricing']) {
  const tiers = [pricing.retail, pricing.wholesale, pricing.bulk];
  const enabled = tiers.find((t) => t?.enabled);
  return enabled ? `₹${enabled.price.toLocaleString('en-IN')}` : '—';
}

export default function SellerProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);

  const authHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (activeTab) params.status = activeTab;

      const res = await axios.get(`${API_URL}/api/seller/products`, {
        params,
        headers: authHeaders(),
      });
      setProducts(res.data.data.products);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleDeactivate = async (productId: string, productName: string) => {
    if (!confirm(`Deactivate "${productName}"? It will no longer be visible to buyers.`)) return;
    setDeactivating(productId);
    try {
      await axios.delete(`${API_URL}/api/seller/products/${productId}`, {
        headers: authHeaders(),
      });
      toast.success('Product deactivated');
      loadProducts();
    } catch {
      toast.error('Failed to deactivate product');
    } finally {
      setDeactivating(null);
    }
  };

  const handleReactivate = async (productId: string, productName: string) => {
    if (!confirm(`Reactivate "${productName}"? It will be visible to buyers again.`)) return;
    setReactivating(productId);
    try {
      await axios.patch(`${API_URL}/api/seller/products/${productId}/reactivate`, {}, {
        headers: authHeaders(),
      });
      toast.success('Product reactivated');
      loadProducts();
    } catch {
      toast.error('Failed to reactivate product');
    } finally {
      setReactivating(null);
    }
  };

  const handleDuplicate = (product: Product) => {
    // Store product data in sessionStorage and navigate to new product page
    sessionStorage.setItem('duplicateProduct', JSON.stringify(product));
    router.push('/seller/products/new?from=duplicate');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination ? `${pagination.total} total products` : 'Manage your product listings'}
          </p>
        </div>
        <Link
          href="/seller/products/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Product
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-500 font-medium">No products found</p>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab ? 'Try a different filter' : 'Add your first product to get started'}
            </p>
            {!activeTab && (
              <Link
                href="/seller/products/new"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline"
              >
                + Add Product
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600 w-16">Image</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Product Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Price (Retail)</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Views</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const status = STATUS_LABELS[product.adminApprovalStatus];
                  const thumbUrl =
                    product.images?.[0]
                      ? `${API_URL}${product.images[0].replace('/products/', '/products/').replace(/\/([^/]+\.webp)$/, '/thumb/$1')}`
                      : null;

                  return (
                    <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${!product.isActive ? 'opacity-50' : ''}`}>
                      {/* Thumbnail */}
                      <td className="py-3 px-4">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 line-clamp-2 max-w-xs">
                          {product.name}
                        </div>
                        {!product.isActive && (
                          <span className="text-xs text-gray-400">Deactivated</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {product.categories.slice(0, 2).map((cat) => (
                            <span key={cat.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {cat.name}
                            </span>
                          ))}
                          {product.categories.length > 2 && (
                            <span className="text-xs text-gray-400">+{product.categories.length - 2}</span>
                          )}
                          {product.categories.length === 0 && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {getRetailPrice(product.multiTierPricing)}
                      </td>

                      {/* Views */}
                      <td className="py-3 px-4 text-gray-500">
                        {product.viewCount.toLocaleString('en-IN')}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/seller/products/${product.id}/edit`}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDuplicate(product)}
                            className="text-xs text-gray-600 hover:text-gray-800 font-medium border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Duplicate
                          </button>
                          {product.isActive ? (
                            <button
                              onClick={() => handleDeactivate(product.id, product.name)}
                              disabled={deactivating === product.id}
                              className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-100 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              {deactivating === product.id ? '...' : 'Deactivate'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(product.id, product.name)}
                              disabled={reactivating === product.id}
                              className="text-xs text-green-600 hover:text-green-800 font-medium border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
                            >
                              {reactivating === product.id ? '...' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
