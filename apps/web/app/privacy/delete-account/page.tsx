'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

function authHeader() {
  const token = localStorage.getItem('accessToken');
  return { Authorization: `Bearer ${token}` };
}

const STEPS = [
  {
    title: 'What gets deleted',
    items: [
      { label: 'Profile PII (email, phone)', action: 'Anonymized → deleted_[id]@deleted.invalid', keep: false },
      { label: 'Password and 2FA settings', action: 'Permanently removed', keep: false },
      { label: 'KYC documents (scans/photos)', action: 'Hard deleted from storage', keep: false },
      { label: 'Saved products & sellers', action: 'Deleted', keep: false },
      { label: 'Active sessions', action: 'All tokens revoked immediately', keep: false },
    ],
  },
  {
    title: 'What is retained (legal obligation)',
    items: [
      { label: 'GST invoices & financial records', action: 'Retained 7 years — GST Act §36', keep: true },
      { label: 'Order history (anonymized)', action: 'Retained for dispute resolution', keep: true },
      { label: 'Audit logs', action: 'Retained 7 years — IT Act §7A', keep: true },
      { label: 'Consent records', action: 'Retained 3 years after deletion', keep: true },
    ],
  },
];

export default function DeleteAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState<'info' | 'confirm'>('info');
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (confirmation !== 'DELETE') { setError('Type DELETE exactly to confirm'); return; }
    setDeleting(true);
    setError('');
    try {
      await axios.post(
        `${API}/api/compliance/delete-account`,
        { confirmation: 'DELETE', reason: reason.trim() || undefined },
        { headers: authHeader() },
      );
      // Clear all local auth data
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('exportRequests');
      router.push('/auth/signin?deleted=1');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Deletion failed. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-6">
          <Link href="/privacy" className="text-sm text-blue-600 hover:underline">← Privacy Policy</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Delete Account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Permanently anonymize your personal data. Your right under DPDP Act §13.
          </p>
        </div>

        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 mb-6">
          <p className="font-semibold text-red-800 text-sm">⚠️ This action is irreversible</p>
          <p className="text-red-700 text-xs mt-1">
            Once you confirm, your personal data will be anonymized immediately. You will be logged out
            and will not be able to recover your account.
          </p>
        </div>

        {STEPS.map((section, si) => (
          <div key={si} className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">{section.title}</h2>
            <div className="space-y-2">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-start justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={item.keep ? 'text-green-500' : 'text-red-500'}>{item.keep ? '✓' : '✕'}</span>
                    <span className="text-gray-700 font-medium">{item.label}</span>
                  </div>
                  <span className={`text-right max-w-xs ${item.keep ? 'text-green-600' : 'text-gray-400'}`}>
                    {item.action}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {step === 'info' ? (
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep('confirm')}
              className="bg-red-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-red-700 font-medium"
            >
              Continue to Confirmation
            </button>
            <Link
              href="/privacy"
              className="text-sm text-gray-600 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancel
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border-2 border-red-300 p-6 mt-4">
            <h2 className="font-semibold text-gray-800 mb-4">Final Confirmation</h2>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">
                Reason for leaving <span className="text-gray-400">(optional, helps us improve)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400"
                placeholder="e.g. Switching to another platform, business closed…"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1">
                Type <strong>DELETE</strong> to confirm account deletion
              </label>
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-400"
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="mb-4 bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting || confirmation !== 'DELETE'}
                className="bg-red-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {deleting ? 'Deleting account…' : 'Permanently Delete Account'}
              </button>
              <button
                onClick={() => setStep('info')}
                className="text-sm text-gray-600 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400 text-center">
          Financial records retained per GST Act §36 and IT Act §7A — DPDP Act §17 exception for legal obligations.
        </p>
      </div>
    </div>
  );
}
