/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const CATEGORIES = [
  { value: 'FRAUD',           label: 'Fraud / Scam' },
  { value: 'PRODUCT_QUALITY', label: 'Product Quality' },
  { value: 'PAYMENT',         label: 'Payment Issue' },
  { value: 'DELIVERY',        label: 'Delivery Problem' },
  { value: 'OTHER',           label: 'Other' },
];

export default function NewComplaintPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    reportedUserId: '',
    category: 'OTHER',
    subject: '',
    description: '',
    orderId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.reportedUserId.trim()) { setError('Reported user ID is required'); return; }
    if (!form.subject.trim()) { setError('Subject is required'); return; }
    if (form.description.trim().length < 20) { setError('Description must be at least 20 characters'); return; }

    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin?returnUrl=/buyer/complaints/new'); return; }

    setSubmitting(true);
    try {
      const payload: any = {
        reportedUserId: form.reportedUserId.trim(),
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
      };
      if (form.orderId.trim()) payload.orderId = form.orderId.trim();

      const res = await axios.post(`${API_URL}/api/complaints`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess(res.data?.data?.message ?? 'Complaint filed successfully');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Complaint Filed</h1>
          <p className="text-gray-600 text-sm">{success}</p>
          <p className="text-xs text-gray-400 mt-3">An acknowledgment has been sent to your email.</p>
          <Link
            href="/buyer/complaints"
            className="mt-6 inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 text-sm"
          >
            View My Complaints
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Complaint</h1>
          <p className="text-sm text-gray-500 mt-0.5">Report an issue — we respond within 48 hours</p>
        </div>
        <Link href="/buyer/complaints" className="text-sm text-blue-600 hover:underline font-medium">
          ← Back to Complaints
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6 text-sm text-blue-800">
        <strong>Consumer Protection Act:</strong> All complaints are addressed within 48 hours as required
        by the Consumer Protection (E-Commerce) Rules 2020.{' '}
        <Link href="/buyer/complaints/grievance" className="underline">
          Data / legal complaints → Grievance Officer
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => update('category', c.value)}
                className={`p-3 rounded-lg border text-sm text-left transition ${
                  form.category === c.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Reported User ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.reportedUserId}
            onChange={(e) => update('reportedUserId', e.target.value)}
            placeholder="User / Seller ID from their profile"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Order ID (optional)</label>
          <input
            type="text"
            value={form.orderId}
            onChange={(e) => update('orderId', e.target.value)}
            placeholder="If this complaint is about a specific order"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            placeholder="Brief description of the issue"
            maxLength={200}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Explain what happened in detail — dates, amounts, communication records…"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{form.description.length} / 5000 characters</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? 'Submitting…' : 'Submit Complaint'}
        </button>
      </form>
    </div>
  );
}
