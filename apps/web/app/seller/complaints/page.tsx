/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN:        { label: 'Open',        color: 'bg-yellow-100 text-yellow-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  RESOLVED:    { label: 'Resolved',    color: 'bg-green-100 text-green-700' },
  CLOSED:      { label: 'Closed',      color: 'bg-gray-100 text-gray-500' },
};

const CATEGORY_LABELS: Record<string, string> = {
  FRAUD:           'Fraud / Scam',
  PRODUCT_QUALITY: 'Product Quality',
  PAYMENT:         'Payment Issue',
  DELIVERY:        'Delivery Problem',
  OTHER:           'Other',
};

export default function SellerComplaintsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin?returnUrl=/seller/complaints'); return; }
    axios
      .get(`${API_URL}/api/complaints/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setTickets(res.data?.data ?? []))
      .catch((err) => {
        const s = err?.response?.status;
        if (s === 401 || s === 403) router.push('/auth/signin');
        else setError(err?.response?.data?.message ?? 'Failed to load complaints');
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Complaints</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all support tickets you&apos;ve filed</p>
        </div>
        <Link
          href="/support"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          + New Complaint
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 mb-5 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
          <p className="text-gray-400 text-sm mb-3">No complaints filed yet.</p>
          <Link href="/support" className="text-sm text-blue-600 hover:underline font-medium">
            File a complaint →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const statusConf = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, color: 'bg-gray-100 text-gray-600' };
            const isBreached = ticket.slaBreach && ticket.status === 'OPEN';
            return (
              <div
                key={ticket.id}
                className={`bg-white rounded-xl border p-5 hover:shadow-sm transition ${isBreached ? 'border-red-200' : 'border-gray-200 hover:border-blue-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-gray-900">{ticket.subject}</p>
                      {isBreached && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          SLA Breached
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                      <span>·</span>
                      <span>#{ticket.id.slice(-8).toUpperCase()}</span>
                      <span>·</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {ticket.latestResponse && (
                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded px-3 py-2 line-clamp-2">
                        <span className="font-medium">Admin:</span> {ticket.latestResponse.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConf.color}`}>
                      {statusConf.label}
                    </span>
                    {ticket.slaDeadline && ticket.status === 'OPEN' && !ticket.slaBreach && (
                      <p className="text-xs text-orange-500">
                        Due {new Date(ticket.slaDeadline).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                      </p>
                    )}
                    {ticket.resolvedAt && (
                      <p className="text-xs text-gray-400">
                        Resolved {new Date(ticket.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400">
          For data privacy complaints under DPDP Act 2023, contact our{' '}
          <Link href="/contact/grievance-officer" className="text-blue-600 hover:underline">
            Grievance Officer
          </Link>.
        </p>
      </div>
    </div>
  );
}
