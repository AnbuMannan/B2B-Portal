/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type BusinessType = 'COMPANY' | 'TRADER' | 'CONSUMER';

interface DashboardData {
  profile: {
    buyerId: string;
    businessType: BusinessType;
    companyName: string | null;
    gstinNumber: string | null;
    isVerified: boolean;
    badge: string | null;
  };
  stats: {
    activeLeads: number;
    quotesReceived: number;
    ordersActive: number;
    savedSellers: number;
  };
  recentLeads: Array<{
    id: string;
    productName: string;
    quantity: number | null;
    unit: string;
    isOpen: boolean;
    expectedCountry: string | null;
    contactChannel: string;
    repeatOption: string;
    expiryDate: string | null;
    postedAt: string;
    category?: { id: string; name: string } | null;
    quotesCount: number;
  }>;
  recentQuotes: Array<{
    id: string;
    sellerName: string;
    sellerId: string;
    sellerVerified: boolean;
    productName: string;
    quotedPrice: number;
    leadTime: string | null;
    notes: string | null;
    status: string;
    createdAt: string;
    expiresAt: string | null;
  }>;
  recentOrders: Array<{
    id: string;
    productName: string;
    sellerName: string;
    sellerId: string;
    amount: number | null;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  QUOTED: { label: 'Quoted', classes: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED: { label: 'Accepted', classes: 'bg-blue-100 text-blue-700' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
  FULFILLED: { label: 'Fulfilled', classes: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-600' },
};

const QUOTE_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  PENDING: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED: { label: 'Accepted', classes: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
};

function KpiCard({
  label,
  value,
  icon,
  href,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href?: string;
  accent: string;
}) {
  const body = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
      <div className={`w-10 h-10 ${accent} rounded-lg flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-10 w-10 bg-gray-200 rounded-lg mb-4" />
      <div className="h-7 w-16 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-28 bg-gray-100 rounded" />
    </div>
  );
}

function ProfileBanner({
  profile,
}: {
  profile: DashboardData['profile'];
}) {
  if (profile.businessType === 'CONSUMER' && !profile.isVerified) {
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">
              Upgrade your profile for the Verified GST Buyer badge
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              Verified buyers get faster responses and contact reveals from premium sellers.
            </p>
          </div>
        </div>
        <Link
          href="/buyer/register"
          className="flex-shrink-0 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add GSTIN
        </Link>
      </div>
    );
  }
  return null;
}

export default function BuyerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/auth/signin?returnUrl=/buyer/dashboard');
      return;
    }

    axios
      .get(`${API_URL}/api/buyer/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data?.data))
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          router.push('/auth/signin?returnUrl=/buyer/dashboard');
        } else if (status === 404) {
          router.push('/buyer/register');
        } else {
          setError(err?.response?.data?.message ?? 'Failed to load dashboard');
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName =
    data?.profile.companyName ??
    (data?.profile.businessType === 'CONSUMER' ? 'there' : 'Buyer');

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {loading ? 'Loading…' : `Welcome back, ${displayName}`}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {data?.profile.badge === 'GST_BUYER' && (
          <span className="flex-shrink-0 flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Verified GST Buyer
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {data && <ProfileBanner profile={data.profile} />}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Active Requirements"
            value={data.stats.activeLeads}
            href="/buyer/requirements"
            accent="bg-blue-100 text-blue-600"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <KpiCard
            label="Quotes Received"
            value={data.stats.quotesReceived}
            href="/buyer/quotes"
            accent="bg-purple-100 text-purple-600"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
            }
          />
          <KpiCard
            label="Active Orders"
            value={data.stats.ordersActive}
            href="/buyer/orders"
            accent="bg-green-100 text-green-600"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
          />
          <KpiCard
            label="Saved Sellers"
            value={data.stats.savedSellers}
            href="/buyer/saved-sellers"
            accent="bg-amber-100 text-amber-600"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            }
          />
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/buyer/requirements/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Post New Requirement
          </Link>
          <Link
            href="/search"
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find Sellers
          </Link>
          <Link
            href="/buyer/saved-sellers"
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            My Saved Sellers
          </Link>
        </div>
      </div>

      {/* Main grid: recent activity */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Requirements */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Recent Requirements</h2>
              <Link href="/buyer/requirements" className="text-sm text-blue-600 hover:underline">
                View all →
              </Link>
            </div>
            {data.recentLeads.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-3">You haven&apos;t posted any requirements yet.</p>
                <Link
                  href="/buyer/requirements/new"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium"
                >
                  Post your first requirement →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.recentLeads.map((l) => (
                  <li key={l.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {l.productName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {l.quantity ? `${l.quantity.toLocaleString('en-IN')} ${l.unit}` : '—'}
                          {l.category?.name && (
                            <span className="ml-2 text-gray-400">• {l.category.name}</span>
                          )}
                          <span className="ml-2 text-gray-400">
                            {new Date(l.postedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          l.isOpen
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {l.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Quotes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Recent Quotes</h2>
              <Link href="/buyer/quotes" className="text-sm text-blue-600 hover:underline">
                View all →
              </Link>
            </div>
            {data.recentQuotes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No quotes received yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.recentQuotes.map((q) => {
                  const statusConf = QUOTE_STATUS_CONFIG[q.status] ?? {
                    label: q.status,
                    classes: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <li key={q.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {q.productName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                            <span className="truncate">{q.sellerName}</span>
                            {q.sellerVerified && (
                              <svg
                                className="w-3 h-3 text-blue-500 flex-shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-gray-900">
                            ₹{Number(q.quotedPrice).toLocaleString('en-IN')}
                          </p>
                          <span
                            className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${statusConf.classes}`}
                          >
                            {statusConf.label}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Recent Orders — spans both columns */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
              <Link href="/buyer/orders" className="text-sm text-blue-600 hover:underline">
                View all →
              </Link>
            </div>
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No orders yet. Accept a quote to create your first order.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Seller</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.recentOrders.map((o) => {
                      const statusConf = ORDER_STATUS_CONFIG[o.status] ?? {
                        label: o.status,
                        classes: 'bg-gray-100 text-gray-600',
                      };
                      return (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="px-2 py-3 font-medium text-gray-800 max-w-[180px] truncate">
                            {o.productName}
                          </td>
                          <td className="px-2 py-3 text-gray-500 max-w-[140px] truncate">
                            {o.sellerName}
                          </td>
                          <td className="px-2 py-3 text-right font-medium text-gray-800">
                            {o.amount != null
                              ? `₹${Number(o.amount).toLocaleString('en-IN')}`
                              : '—'}
                          </td>
                          <td className="px-2 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.classes}`}>
                              {statusConf.label}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-gray-400 whitespace-nowrap">
                            {new Date(o.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
