/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const BUSINESS_TYPES = [
  { value: 'COMPANY',  label: 'Company (GSTIN verified)' },
  { value: 'TRADER',   label: 'Trader' },
  { value: 'CONSUMER', label: 'Individual / Consumer' },
];

export default function BuyerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    businessType: '',
    companyName: '',
    gstinNumber: '',
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin?returnUrl=/buyer/profile'); return; }
    axios
      .get(`${API_URL}/api/buyer/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const p = res.data?.data;
        setProfile(p);
        setForm({
          businessType: p.businessType ?? '',
          companyName: p.companyName ?? '',
          gstinNumber: p.gstinNumber ?? '',
        });
      })
      .catch((err) => {
        const s = err?.response?.status;
        if (s === 401 || s === 403) router.push('/auth/signin');
        else setError(err?.response?.data?.message ?? 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const validate = (): string | null => {
    if (form.gstinNumber && !GSTIN_RE.test(form.gstinNumber)) {
      return 'Invalid GSTIN format (e.g. 27AAECL1234A1Z5)';
    }
    if (form.businessType === 'COMPANY' && !form.gstinNumber) {
      return 'GSTIN is required for Company type';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);

    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setSaving(true);
    try {
      const payload: any = { businessType: form.businessType };
      if (form.companyName.trim()) payload.companyName = form.companyName.trim();
      if (form.gstinNumber.trim()) payload.gstinNumber = form.gstinNumber.trim().toUpperCase();

      const res = await axios.patch(`${API_URL}/api/buyer/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile((prev: any) => ({ ...prev, ...res.data?.data }));
      showToast('Profile updated successfully');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-xl mx-auto animate-pulse space-y-4">
        <div className="h-5 bg-gray-200 rounded w-32" />
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Buyer Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Update your business details and GSTIN</p>
      </div>

      {/* Account info (read-only) */}
      {profile && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
              {profile.user?.email?.[0]?.toUpperCase() ?? 'B'}
            </div>
            <div>
              <p className="font-semibold text-blue-900 text-sm">{profile.user?.email}</p>
              {profile.badge && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {profile.badge === 'GST_BUYER' ? 'Verified GST Buyer' : profile.badge}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        {/* Business type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Business type</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {BUSINESS_TYPES.map((bt) => (
              <button
                type="button"
                key={bt.value}
                onClick={() => setForm((f) => ({ ...f, businessType: bt.value }))}
                className={`p-3 rounded-lg border text-sm text-left transition ${
                  form.businessType === bt.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {bt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Company name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Company / Trade name</label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            placeholder="Acme Traders Pvt Ltd"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* GSTIN */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            GSTIN
            {form.businessType === 'COMPANY' && <span className="text-red-500 ml-1">*</span>}
            <span className="ml-1 text-xs font-normal text-gray-400">(unlocks Verified GST Buyer badge)</span>
          </label>
          <input
            type="text"
            value={form.gstinNumber}
            onChange={(e) => setForm((f) => ({ ...f, gstinNumber: e.target.value.toUpperCase() }))}
            placeholder="27AAECL1234A1Z5"
            maxLength={15}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
          />
          {profile?.isVerified && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              GSTIN verified
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
