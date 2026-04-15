/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import KpiCards from './components/KpiCards';
import RecentLeads from './components/RecentLeads';
import WalletSummary from './components/WalletSummary';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_STARTED';

interface DashboardData {
  profile: {
    sellerId: string;
    companyName: string;
    kycStatus: KycStatus;
    rejectionReason: string | null;
    badges: string[];
    state: string | null;
    city: string | null;
  };
  kpis: {
    leadCreditBalance: number;
    activeListings: number;
    pendingListings: number;
    profileViews7d: number;
    profileViews30d: number;
    enquiriesReceived: number;
    activeOrders: number;
    unreadNotifications: number;
  };
  recentLeads: any[];
  recentOrders: any[];
  walletSummary: {
    balance: number;
    lastRechargeDate: string | null;
    lowBalanceAlert: boolean;
    recentTransactions: any[];
  };
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  QUOTED: { label: 'Quoted', classes: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED: { label: 'Accepted', classes: 'bg-blue-100 text-blue-700' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
  FULFILLED: { label: 'Fulfilled', classes: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-600' },
};

function KycBanner({ status, reason }: { status: KycStatus; reason: string | null }) {
  if (status === 'APPROVED') return null;

  if (status === 'PENDING') {
    return (
      <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Your KYC is under review
            </p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Expected verification time: 48 business hours. You&apos;ll be notified by SMS and email.
            </p>
          </div>
        </div>
        <Link
          href="/seller/register"
          className="flex-shrink-0 text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 transition-colors"
        >
          View Status
        </Link>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="flex items-start justify-between bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">KYC Verification Rejected</p>
            {reason && (
              <p className="text-xs text-red-600 mt-0.5">Reason: {reason}</p>
            )}
          </div>
        </div>
        <Link
          href="/seller/register"
          className="flex-shrink-0 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
        >
          Re-apply
        </Link>
      </div>
    );
  }

  return null;
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

export default function SellerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/auth/signin?returnUrl=/seller/dashboard');
      return;
    }

    axios
      .get(`${API_URL}/api/seller/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setData(res.data?.data);
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          router.push('/auth/signin?returnUrl=/seller/dashboard');
        } else {
          setError(err?.response?.data?.message ?? 'Failed to load dashboard');
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {loading ? 'Loading…' : data ? `Welcome back, ${data.profile.companyName}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Verified badge */}
        {data?.profile.kycStatus === 'APPROVED' && (
          <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified Seller
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* KYC Status Banner */}
      {data && (
        <KycBanner
          status={data.profile.kycStatus}
          reason={data.profile.rejectionReason}
        />
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data ? (
        <div className="mb-6">
          <KpiCards kpis={data.kpis} lowBalance={data.walletSummary.lowBalanceAlert} />
        </div>
      ) : null}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/seller/products/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Product
          </Link>
          <Link
            href="/seller/buy-leads"
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Browse Buy Leads
          </Link>
          <Link
            href="/seller/wallet"
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Recharge Credits
          </Link>
        </div>
      </div>

      {/* Main content grid */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2/3 — leads + orders */}
          <div className="lg:col-span-2 space-y-6">
            <RecentLeads leads={data.recentLeads} />

            {/* Recent Orders */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
                <Link href="/seller/orders" className="text-sm text-blue-600 hover:underline">
                  View all →
                </Link>
              </div>

              {data.recentOrders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No orders yet</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Buyer</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.recentOrders.map((order) => {
                        const statusConf = ORDER_STATUS_CONFIG[order.status] ?? {
                          label: order.status,
                          classes: 'bg-gray-100 text-gray-600',
                        };
                        return (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-2 py-3 font-medium text-gray-800 max-w-[140px] truncate">
                              {order.productName}
                            </td>
                            <td className="px-2 py-3 text-gray-500">{order.buyerMasked}</td>
                            <td className="px-2 py-3 text-right font-medium text-gray-800">
                              {order.amount != null
                                ? `₹${Number(order.amount).toLocaleString('en-IN')}`
                                : '—'}
                            </td>
                            <td className="px-2 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.classes}`}>
                                {statusConf.label}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-gray-400 whitespace-nowrap">
                              {new Date(order.createdAt).toLocaleDateString('en-IN', {
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

          {/* Right 1/3 — wallet */}
          <div>
            <WalletSummary wallet={data.walletSummary} />
          </div>
        </div>
      )}
    </div>
  );
}
