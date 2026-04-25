/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type BusinessType = 'COMPANY' | 'TRADER' | 'CONSUMER';

const BUSINESS_TYPES: {
  value: BusinessType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'COMPANY',
    label: 'Registered Company',
    description: 'GST-registered business — Pvt Ltd, LLP, Proprietorship',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    value: 'TRADER',
    label: 'Trader / Reseller',
    description: 'Retailer, wholesaler, or small trader buying stock',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    value: 'CONSUMER',
    label: 'End Consumer',
    description: 'Buying for personal / end-use, not for resale',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
        />
      </svg>
    ),
  },
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

type StepNum = 1 | 2;

interface CompletionResult {
  buyerId: string;
  businessType: BusinessType;
  isVerified: boolean;
  companyName: string | null;
  badge: string | null;
}

export default function BuyerRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepNum>(1);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [gstin, setGstin] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/auth/signin?returnUrl=/buyer/register');
      return;
    }
    setBooting(false);
  }, [router]);

  const handleTypeSelect = (value: BusinessType) => {
    setBusinessType(value);
    setStep(2);
    setServerError(null);
  };

  const gstinValid = gstin ? GSTIN_REGEX.test(gstin) : false;

  const handleSubmit = async () => {
    if (!businessType) return;
    if (businessType === 'COMPANY' && (!gstin || !gstinValid)) {
      setServerError('A valid 15-character GSTIN is required for COMPANY buyers');
      return;
    }

    setSubmitting(true);
    setServerError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.post(
        `${API_URL}/api/buyer/profile/complete`,
        {
          businessType,
          gstinNumber: gstin ? gstin.toUpperCase().trim() : undefined,
          companyName: companyName || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setResult(res.data?.data as CompletionResult);
      setTimeout(() => router.push('/buyer/dashboard'), 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setServerError(
        Array.isArray(msg)
          ? msg[0]
          : typeof msg === 'string'
            ? msg
            : 'Could not complete your profile. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipGstin = async () => {
    setGstin('');
    await handleSubmit();
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
          <p className="text-sm text-gray-600 mb-4">
            Your buyer profile has been created
            {result.isVerified ? ' and verified via GSTN' : ''}.
          </p>
          {result.badge === 'GST_BUYER' && (
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium mb-4">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Verified GST Buyer
            </div>
          )}
          <p className="text-xs text-gray-400">Redirecting you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 mb-1"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white text-xs font-bold">
                B2B
              </span>
              <span>Marketplace</span>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Buyer Registration</h1>
            <p className="text-sm text-gray-500">
              Tell us about your business — takes under a minute
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="hidden sm:block text-sm text-gray-500 hover:text-gray-700"
          >
            Skip for now
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2].map((n) => {
            const isDone = step > n;
            const isCurrent = step === n;
            return (
              <div key={n} className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    n
                  )}
                </div>
                <span className={`text-sm ${isCurrent ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
                  {n === 1 ? 'Business Type' : 'GSTIN (optional)'}
                </span>
                {n === 1 && <span className="w-10 h-0.5 bg-gray-200" />}
              </div>
            );
          })}
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            {serverError}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {/* ── STEP 1 ────────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                How will you use B2B Bazaar?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Pick the option that best describes your buying activity.
              </p>
              <div className="space-y-3">
                {BUSINESS_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => handleTypeSelect(t.value)}
                    className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl transition-all text-left ${
                      businessType === t.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        businessType === t.value
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{t.label}</p>
                      <p className="text-sm text-gray-500">{t.description}</p>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 2 ────────────────────────────────────────────────── */}
          {step === 2 && businessType && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {businessType === 'COMPANY'
                  ? 'GST Verification'
                  : 'Got a GSTIN?'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {businessType === 'COMPANY' ? (
                  <>
                    Enter your GSTIN — we&apos;ll verify it in real time and award you the{' '}
                    <span className="font-medium text-green-700">Verified GST Buyer</span> badge.
                  </>
                ) : (
                  <>
                    Adding a GSTIN unlocks the <span className="font-medium text-green-700">Verified GST Buyer</span>{' '}
                    badge and helps sellers trust your enquiries. You can skip this for now.
                  </>
                )}
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GSTIN {businessType === 'COMPANY' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) =>
                      setGstin(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15),
                      )
                    }
                    placeholder="27AAECL1234A1Z5"
                    maxLength={15}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono tracking-wide focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-400">15-character GSTIN issued by the GST dept.</p>
                    <p className="text-xs font-mono text-gray-400">{gstin.length}/15</p>
                  </div>
                  {gstin && !gstinValid && (
                    <p className="text-xs text-red-600 mt-1">
                      Invalid GSTIN format. Expected pattern: 2 digits + 5 letters + 4 digits + letter + alphanumeric + Z + alphanumeric.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your registered business name"
                    maxLength={200}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Leave blank — we&apos;ll pull it from your GSTIN record when available.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-3">
                  {businessType !== 'COMPANY' && (
                    <button
                      type="button"
                      onClick={handleSkipGstin}
                      disabled={submitting}
                      className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Skip & continue
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      submitting ||
                      (businessType === 'COMPANY' && !gstinValid)
                    }
                    className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {submitting && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {submitting ? 'Verifying…' : 'Complete registration'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          You can post requirements without a GSTIN, but verified buyers get faster seller responses.
        </p>
      </div>
    </div>
  );
}
