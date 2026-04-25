/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const CATEGORIES = [
  { value: 'DATA_ACCESS',  label: 'Data Access Request' },
  { value: 'DATA_ERASURE', label: 'Data Erasure (Right to be Forgotten)' },
  { value: 'GDPR',         label: 'GDPR / Privacy Concern' },
  { value: 'LEGAL',        label: 'Legal / Regulatory Issue' },
  { value: 'OTHER',        label: 'Other' },
];

export default function BuyerGrievancePage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    category: 'OTHER',
    subject: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (!form.subject.trim()) { setError('Subject is required'); return; }
    if (form.description.trim().length < 20) { setError('Description must be at least 20 characters'); return; }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/api/grievance-officer/contact`, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
      });
      setSuccess(res.data?.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Submission failed. Please try again.');
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">Grievance Submitted</h1>
          <p className="text-gray-600 text-sm">{success.message}</p>
          <p className="text-xs text-gray-400 mt-2">Reference: {success.referenceId?.slice(-12).toUpperCase()}</p>
          <Link
            href="/buyer/complaints"
            className="mt-6 inline-block text-sm text-blue-600 hover:underline"
          >
            ← Back to My Complaints
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Grievance Officer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Data privacy &amp; legal complaints under IT Act / DPDP Act 2023</p>
        </div>
        <Link href="/buyer/complaints" className="text-sm text-blue-600 hover:underline font-medium">
          ← Back to Complaints
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Designated Grievance Officer</p>
        <div className="space-y-1 text-sm text-gray-700">
          <p><span className="font-medium">Name:</span> B2B Marketplace Compliance Team</p>
          <p><span className="font-medium">Email:</span> grievance@b2bmarketplace.in</p>
          <p><span className="font-medium">Response Time:</span> Within 15 days (as mandated by law)</p>
          <p><span className="font-medium">Address:</span> B2B Marketplace India Pvt. Ltd., India</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-sm text-amber-800">
        <strong>Use this form for:</strong> data access requests, data erasure (DPDP Act), privacy violations,
        IT Act compliance issues, or legal notices.{' '}
        <Link href="/buyer/complaints/new" className="underline">
          General support complaints → here
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Complaint category</label>
          <div className="space-y-2">
            {CATEGORIES.map((c) => (
              <label key={c.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value={c.value}
                  checked={form.category === c.value}
                  onChange={() => update('category', c.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Phone (optional)</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+91 XXXXX XXXXX"
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
            maxLength={200}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Detailed description <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Describe your concern in detail. For data requests, include the specific data you want accessed or erased."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? 'Submitting…' : 'Submit to Grievance Officer'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          By submitting, you consent to our processing your personal data to handle this grievance
          under the DPDP Act 2023.
        </p>
      </form>
    </div>
  );
}
