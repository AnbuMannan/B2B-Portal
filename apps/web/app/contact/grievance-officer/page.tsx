'use client';

import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const CATEGORIES = [
  { value: 'DATA_BREACH', label: 'Data Breach / Unauthorized Access' },
  { value: 'CONSENT', label: 'Consent Issues (given / withdrawn)' },
  { value: 'ERASURE', label: 'Right to Erasure / Deletion' },
  { value: 'CORRECTION', label: 'Incorrect / Outdated Personal Data' },
  { value: 'PORTABILITY', label: 'Data Portability (export request)' },
  { value: 'OTHER', label: 'Other Privacy Concern' },
];

const GRIEVANCE_OFFICER = {
  name: 'Rajesh Kumar',
  title: 'Grievance Officer',
  email: 'grievance@b2bmarket.in',
  phone: '+91-80-4567-8901',
};

interface SubmitResult {
  referenceNumber: string;
  slaDeadline: string;
  message: string;
}

interface GrievanceStatus {
  status: string;
  respondedAt?: string;
  responseNotes?: string;
  slaBreach?: boolean;
}

export default function GrievanceOfficerPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', subject: '', description: '', category: 'OTHER',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const [statusTicketId, setStatusTicketId] = useState('');
  const [statusEmail, setStatusEmail] = useState('');
  const [statusResult, setStatusResult] = useState<GrievanceStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (form.description.trim().length < 20) e.description = 'Provide at least 20 characters of detail';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true); setErrors({});
    try {
      const res = await axios.post(`${API}/api/compliance/grievance`, form);
      setResult(res.data.data as SubmitResult);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ submit: msg ?? 'Submission failed. Please email us directly.' });
    } finally { setSubmitting(false); }
  };

  const checkStatus = async () => {
    if (!statusTicketId.trim() || !statusEmail.trim()) return;
    setCheckingStatus(true); setStatusError(''); setStatusResult(null);
    try {
      const res = await axios.get(
        `${API}/api/compliance/grievance/status?ticketId=${statusTicketId.trim()}&email=${encodeURIComponent(statusEmail.trim())}`,
      );
      setStatusResult(res.data.data as GrievanceStatus);
    } catch {
      setStatusError('Ticket not found. Check your ticket ID and email.');
    } finally { setCheckingStatus(false); }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Grievance Submitted</h2>
          <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
            <p className="text-xs text-gray-500 mb-1">Reference Number</p>
            <p className="font-mono font-bold text-blue-700 text-lg">#{result.referenceNumber}</p>
            <p className="text-xs text-gray-500 mt-3 mb-1">Response Deadline (72h SLA)</p>
            <p className="font-medium text-sm">
              {new Date(result.slaDeadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </p>
          </div>
          <p className="text-sm text-gray-600 mb-6">{result.message}</p>
          <p className="text-xs text-gray-400 mb-4">
            Acknowledgement sent to <strong>{form.email}</strong>. Save your reference number.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700">
              Go Home
            </Link>
            <Link href="/privacy" className="text-sm text-gray-600 px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <span>/</span>
            <Link href="/privacy" className="hover:text-blue-600">Privacy</Link>
            <span>/</span>
            <span>Grievance Officer</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Grievance Officer</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mandatory contact under the Digital Personal Data Protection Act 2023 §13
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Grievance Officer</h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{GRIEVANCE_OFFICER.name}</p>
                <p className="text-gray-500 text-xs">{GRIEVANCE_OFFICER.title}</p>
                <a href={`mailto:${GRIEVANCE_OFFICER.email}`} className="block text-blue-600 hover:underline text-xs break-all">
                  {GRIEVANCE_OFFICER.email}
                </a>
                <p className="text-gray-600 text-xs">{GRIEVANCE_OFFICER.phone}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="font-semibold text-amber-800 text-sm mb-2">⏱ 72-Hour SLA</h4>
              <p className="text-xs text-amber-700">
                The Grievance Officer is legally required to respond within{' '}
                <strong>72 hours</strong> per DPDP Act §13(3).
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Track Grievance</h3>
              <div className="space-y-2">
                <input
                  value={statusTicketId}
                  onChange={(e) => setStatusTicketId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  placeholder="Ticket ID"
                />
                <input
                  value={statusEmail}
                  onChange={(e) => setStatusEmail(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  placeholder="Your email"
                />
                {statusError && <p className="text-red-500 text-xs">{statusError}</p>}
                {statusResult && (
                  <div className="bg-gray-50 rounded p-3 text-xs space-y-1">
                    <p><strong>Status:</strong> {statusResult.status}</p>
                    {statusResult.respondedAt && (
                      <p><strong>Responded:</strong> {new Date(statusResult.respondedAt).toLocaleDateString('en-IN')}</p>
                    )}
                    {statusResult.responseNotes && (
                      <p className="text-gray-600">{statusResult.responseNotes}</p>
                    )}
                    {statusResult.slaBreach && (
                      <p className="text-red-500 font-medium">⚠️ SLA breached</p>
                    )}
                  </div>
                )}
                <button
                  onClick={checkStatus}
                  disabled={checkingStatus}
                  className="w-full bg-gray-100 text-gray-700 text-xs py-2 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {checkingStatus ? 'Checking…' : 'Check Status'}
                </button>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-5">File a Grievance</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${errors.name ? 'border-red-400' : 'focus:border-blue-400'}`}
                    placeholder="Your name"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-0.5">{errors.name}</p>}
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-gray-600 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${errors.email ? 'border-red-400' : 'focus:border-blue-400'}`}
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-0.5">{errors.email}</p>}
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-gray-600 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="+91-9876543210"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-gray-600 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Subject *</label>
                  <input
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${errors.subject ? 'border-red-400' : 'focus:border-blue-400'}`}
                    placeholder="Brief description of your concern"
                    maxLength={300}
                  />
                  {errors.subject && <p className="text-red-500 text-xs mt-0.5">{errors.subject}</p>}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    Detailed Description * <span className="text-gray-400">(min. 20 chars)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={6}
                    className={`w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none ${errors.description ? 'border-red-400' : 'focus:border-blue-400'}`}
                    placeholder="Describe your concern, include dates and what resolution you expect."
                    maxLength={5000}
                  />
                  <div className="flex justify-between mt-0.5">
                    {errors.description
                      ? <p className="text-red-500 text-xs">{errors.description}</p>
                      : <span />
                    }
                    <span className="text-xs text-gray-400">{form.description.length}/5000</span>
                  </div>
                </div>

                {errors.submit && (
                  <div className="col-span-2 bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">
                    {errors.submit}
                  </div>
                )}

                <div className="col-span-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-blue-600 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {submitting ? 'Submitting…' : 'Submit Grievance'}
                  </button>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-400">
                Available to all users — no account required. Response within 72h per DPDP Act §13(3).
                Unsatisfied? Contact the Data Protection Board of India once constituted.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
