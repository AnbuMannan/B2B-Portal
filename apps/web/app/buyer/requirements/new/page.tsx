/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';


const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
];

type FormState = {
  productName: string;
  categoryId: string | null;
  requirementType: 'RETAIL' | 'WHOLESALE' | '';
  quantity: string;
  unit: string;
  targetPriceMin: string;
  targetPriceMax: string;
  currency: 'INR' | 'USD';
  deliveryState: string;
  expectedCountry: string;
  contactChannel: 'WHATSAPP' | 'TELEGRAM' | 'EMAIL';
  repeatOption: 'NONE' | 'WEEKLY' | 'MONTHLY';
  additionalNotes: string;
};

const INITIAL: FormState = {
  productName: '',
  categoryId: null,
  requirementType: '',
  quantity: '',
  unit: 'pieces',
  targetPriceMin: '',
  targetPriceMax: '',
  currency: 'INR',
  deliveryState: '',
  expectedCountry: 'India',
  contactChannel: 'WHATSAPP',
  repeatOption: 'NONE',
  additionalNotes: '',
};

const DRAFT_KEY = 'postRequirementDraft';

export default function PostRequirementPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [suggestions, setSuggestions] = useState<{ text: string }[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [successLead, setSuccessLead] = useState<any>(null);
  const autocompleteTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined'
        ? localStorage.getItem(DRAFT_KEY)
        : null;
      if (raw) setForm({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      // ignore malformed draft
    }
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        /* quota exceeded — ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (form.productName.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    autocompleteTimer.current = setTimeout(async () => {
      try {
        const res = await axios.get(
          `${API_URL}/api/search/autocomplete?q=${encodeURIComponent(form.productName.trim())}`,
        );
        const products = res.data?.products ?? res.data?.data?.products ?? [];
        setSuggestions(products.slice(0, 6));
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    };
  }, [form.productName]);

  const validate = (): string | null => {
    if (!form.productName.trim()) return 'Product name is required';
    if (!form.contactChannel) return 'Please pick a contact channel';
    if (form.requirementType === '') return 'Please pick Retail or Wholesale';
    const min = form.targetPriceMin === '' ? null : Number(form.targetPriceMin);
    const max = form.targetPriceMax === '' ? null : Number(form.targetPriceMax);
    if (min != null && max != null && min > max) {
      return 'Min price cannot exceed max price';
    }
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const v = validate();
    if (v) {
      setErrorMsg(v);
      return;
    }

    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;

    if (!token) {
      setShowRegisterPrompt(true);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        productName: form.productName.trim(),
        requirementType: form.requirementType,
        unit: form.unit || undefined,
        currency: form.currency,
        deliveryState: form.deliveryState || undefined,
        expectedCountry: form.expectedCountry || 'India',
        contactChannel: form.contactChannel,
        repeatOption: form.repeatOption,
        additionalNotes: form.additionalNotes || undefined,
      };
      if (form.quantity) payload.quantity = Number(form.quantity);
      if (form.targetPriceMin) payload.targetPriceMin = Number(form.targetPriceMin);
      if (form.targetPriceMax) payload.targetPriceMax = Number(form.targetPriceMax);

      const res = await axios.post(
        `${API_URL}/api/buyer/requirements`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      localStorage.removeItem(DRAFT_KEY);
      setSuccessLead(res.data?.data ?? res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setShowRegisterPrompt(true);
      } else if (status === 403) {
        router.push('/buyer/register');
      } else {
        setErrorMsg(
          err?.response?.data?.message ??
            'Something went wrong while posting your requirement.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (successLead) {
    const sym = form.currency === 'USD' ? '$' : '₹';
    const priceRange =
      form.targetPriceMin && form.targetPriceMax
        ? `${sym}${form.targetPriceMin} – ${sym}${form.targetPriceMax}`
        : form.targetPriceMin || form.targetPriceMax
          ? `${sym}${form.targetPriceMin || form.targetPriceMax}`
          : '—';
    const successBody = (
      <div className="bg-gradient-to-br from-green-50 to-white px-4 py-10 min-h-full">
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-green-100">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Your requirement has been posted!</h1>
              <p className="text-gray-600 mt-2">
                Verified sellers will contact you within 24 hours.
              </p>
            </div>

            <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-semibold text-gray-900">{successLead.productName}</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                  {form.requirementType || 'OPEN'}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Quantity</dt>
                  <dd className="text-gray-900 font-medium">
                    {form.quantity || '—'} {form.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Target price</dt>
                  <dd className="text-gray-900 font-medium">{priceRange}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Deliver to</dt>
                  <dd className="text-gray-900 font-medium">
                    {form.deliveryState || form.expectedCountry}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Contact via</dt>
                  <dd className="text-gray-900 font-medium">{form.contactChannel}</dd>
                </div>
                {form.repeatOption !== 'NONE' && (
                  <div className="col-span-2">
                    <dt className="text-gray-500">Repeats</dt>
                    <dd className="text-gray-900 font-medium">{form.repeatOption}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setSuccessLead(null);
                  setForm(INITIAL);
                  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
                }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
              >
                Post Another
              </button>
              <Link
                href="/buyer/requirements"
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 text-center"
              >
                View My Requirements
              </Link>
            </div>
          </div>
        </div>
    );
    return successBody;
  }

  const formBody = (
      <div className="bg-gray-50 py-10 px-4 min-h-full">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Post Buy Requirement</h1>
            <p className="text-gray-600 mt-1">
              Tell us what you need — verified sellers will quote within hours.
            </p>
          </div>

          {showRegisterPrompt && (
            <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-900">
                  Please sign in or register to submit
                </p>
                <p className="text-xs text-yellow-800 mt-0.5">
                  Your draft is saved — you&apos;ll return here after.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/auth/signin"
                    className="text-xs font-semibold px-3 py-1.5 rounded-md bg-yellow-600 text-white hover:bg-yellow-700"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/register"
                    className="text-xs font-semibold px-3 py-1.5 rounded-md bg-white text-yellow-700 border border-yellow-300 hover:bg-yellow-100"
                  >
                    Register
                  </Link>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5"
          >
            {errorMsg && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Product you need <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => update('productName', e.target.value)}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                placeholder="e.g. Cotton T-shirts, LED Bulbs"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {showSuggest && suggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {suggestions.map((s, i) => (
                    <li
                      key={`${s.text}-${i}`}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                      onMouseDown={() => {
                        update('productName', s.text);
                        setSuggestions([]);
                      }}
                    >
                      {s.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Requirement type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['RETAIL', 'WHOLESALE'] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => update('requirementType', t)}
                    className={`p-3 rounded-lg border text-sm font-semibold transition ${
                      form.requirementType === t
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {t === 'RETAIL' ? 'Retail (small qty)' : 'Wholesale (bulk)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => update('quantity', e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => update('unit', e.target.value)}
                  placeholder="pieces / kg / meters"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Target price range
              </label>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  min="0"
                  value={form.targetPriceMin}
                  onChange={(e) => update('targetPriceMin', e.target.value)}
                  placeholder="Min"
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="number"
                  min="0"
                  value={form.targetPriceMax}
                  onChange={(e) => update('targetPriceMax', e.target.value)}
                  placeholder="Max"
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <select
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value as 'INR' | 'USD')}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Delivery state
                </label>
                <select
                  value={form.deliveryState}
                  onChange={(e) => update('deliveryState', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select state (optional)</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={form.expectedCountry}
                  onChange={(e) => update('expectedCountry', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                How should sellers contact you? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['WHATSAPP', 'TELEGRAM', 'EMAIL'] as const).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => update('contactChannel', c)}
                    className={`p-3 rounded-lg border text-xs font-semibold uppercase tracking-wide transition ${
                      form.contactChannel === c
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Repeat purchase?
              </label>
              <select
                value={form.repeatOption}
                onChange={(e) =>
                  update('repeatOption', e.target.value as FormState['repeatOption'])
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="NONE">One-time purchase</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Additional notes
              </label>
              <textarea
                rows={3}
                value={form.additionalNotes}
                onChange={(e) => update('additionalNotes', e.target.value)}
                placeholder="Material, specifications, packaging, deadlines…"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition"
            >
              {submitting ? 'Posting…' : 'Post Requirement'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              By posting, you agree to share your contact with verified sellers who purchase leads.
            </p>
          </form>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-4">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Your contact details are <span className="font-semibold text-gray-900">never shared publicly</span>.
              </p>
            </div>
            <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">Verified sellers</span> will contact you directly.
              </p>
            </div>
            <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-4">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">Free to post.</span> No registration fee.
              </p>
            </div>
          </div>
        </div>
      </div>
  );

  return formBody;
}
