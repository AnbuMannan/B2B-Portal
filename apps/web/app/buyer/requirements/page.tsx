/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type RequirementStatus = 'OPEN' | 'QUOTED' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';

type Requirement = {
  id: string;
  productName: string;
  requirementType: 'RETAIL' | 'WHOLESALE' | null;
  quantity: number | null;
  unit: string | null;
  targetPriceMin: number | null;
  targetPriceMax: number | null;
  currency: string;
  deliveryState: string | null;
  expectedCountry: string | null;
  contactChannel: string;
  repeatOption: string;
  additionalNotes: string | null;
  isOpen: boolean;
  expiryDate: string | null;
  createdAt: string;
  quoteCount: number;
  revealCount: number;
  status: RequirementStatus;
  category?: { id: string; name: string } | null;
};

const STATUS_STYLES: Record<RequirementStatus, { label: string; className: string }> = {
  OPEN:      { label: 'Open',       className: 'bg-blue-100 text-blue-700' },
  QUOTED:    { label: 'Quoted',     className: 'bg-emerald-100 text-emerald-700' },
  FULFILLED: { label: 'Fulfilled',  className: 'bg-indigo-100 text-indigo-700' },
  EXPIRED:   { label: 'Expired',    className: 'bg-amber-100 text-amber-800' },
  CANCELLED: { label: 'Cancelled',  className: 'bg-gray-200 text-gray-600' },
};

export default function BuyerRequirementsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/signin');
        return;
      }
      const res = await axios.get(`${API_URL}/api/buyer/requirements`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: 1, limit: 50 },
      });
      const payload = res.data?.data ?? res.data;
      setItems(payload?.requirements ?? []);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push('/auth/signin');
        return;
      }
      if (err?.response?.status === 404) {
        router.push('/buyer/register');
        return;
      }
      setError(err?.response?.data?.message ?? 'Failed to load requirements.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const onCancel = async (id: string) => {
    if (!confirm('Cancel this requirement? Sellers will no longer see it.')) return;
    setBusyId(id);
    try {
      const token = localStorage.getItem('accessToken');
      await axios.delete(`${API_URL}/api/buyer/requirements/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      flash('Requirement cancelled');
      load();
    } catch (err: any) {
      flash(err?.response?.data?.message ?? 'Failed to cancel');
    } finally {
      setBusyId(null);
    }
  };

  const onRepost = async (id: string) => {
    setBusyId(id);
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(
        `${API_URL}/api/buyer/requirements/${id}/repost`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      flash('Requirement reposted — notifying sellers');
      load();
    } catch (err: any) {
      flash(err?.response?.data?.message ?? 'Failed to repost');
    } finally {
      setBusyId(null);
    }
  };

  const formatPrice = (r: Requirement) => {
    if (r.targetPriceMin == null && r.targetPriceMax == null) return '—';
    const sym = r.currency === 'USD' ? '$' : '₹';
    if (r.targetPriceMin != null && r.targetPriceMax != null) {
      return `${sym}${r.targetPriceMin} – ${sym}${r.targetPriceMax}`;
    }
    return `${sym}${r.targetPriceMin ?? r.targetPriceMax}`;
  };

  const formatExpiry = (iso: string | null) => {
    if (!iso) return 'No expiry';
    const d = new Date(iso);
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `${days} days left`;
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Requirements</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track status, edit open requirements, or repost expired ones.
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
            Loading…
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <h2 className="font-semibold text-gray-900">No requirements yet</h2>
            <p className="text-sm text-gray-500 mt-1">
              Post your first buy requirement to start receiving quotes.
            </p>
            <Link
              href="/buyer/requirements/new"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              Post Requirement
            </Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((r) => {
              const badge = STATUS_STYLES[r.status];
              const canEdit = r.status === 'OPEN' && r.revealCount === 0;
              const canCancel = r.status === 'OPEN' || r.status === 'QUOTED';
              const canRepost = r.status === 'EXPIRED' || r.status === 'CANCELLED';
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{r.productName}</h3>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                        {r.requirementType && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                            {r.requirementType}
                          </span>
                        )}
                        {r.quoteCount > 0 && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700">
                            {r.quoteCount} {r.quoteCount === 1 ? 'quote' : 'quotes'}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          Qty: <span className="text-gray-700 font-medium">
                            {r.quantity ?? '—'} {r.unit ?? ''}
                          </span>
                        </span>
                        <span>
                          Price: <span className="text-gray-700 font-medium">{formatPrice(r)}</span>
                        </span>
                        {r.deliveryState && (
                          <span>
                            Deliver to: <span className="text-gray-700 font-medium">{r.deliveryState}</span>
                          </span>
                        )}
                        <span>
                          Contact via: <span className="text-gray-700 font-medium">{r.contactChannel}</span>
                        </span>
                        <span>{formatExpiry(r.expiryDate)}</span>
                      </div>
                      {r.additionalNotes && (
                        <p className="mt-2 text-xs text-gray-600 line-clamp-2">
                          {r.additionalNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canEdit && (
                        <Link
                          href={`/buyer/requirements/${r.id}/edit`}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          Edit
                        </Link>
                      )}
                      {canRepost && (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => onRepost(r.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          Repost
                        </button>
                      )}
                      {canCancel && (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => onCancel(r.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
