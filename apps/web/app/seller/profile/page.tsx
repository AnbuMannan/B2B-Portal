/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KycDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

interface SellerProfile {
  id: string;
  companyName: string;
  companyType: string;
  logoUrl: string | null;
  companyInitials: string;
  badges: string[];
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  isVerified: boolean;
  approvalDate: string | null;
  rejectionReason: string | null;
  contact: { email: string; phone: string | null; phoneVerified: boolean };
  address: {
    businessOfficeAddress: string | null;
    registeredOfficeAddress: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string;
  };
  kyc: {
    gstNumber: string | null;
    panNumber: string | null;
    iecCode: string | null;
    udyamNumber: string | null;
    industryType: string[];
    businessModel: string | null;
    hasIEC: boolean;
    directorName: string | null;
    directorDesignation: string | null;
    aadhaarLastFour: string | null;
  };
  documents: KycDocument[];
  memberSince: string;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  VERIFIED_SELLER: { label: 'Verified Seller',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  GST_VERIFIED:    { label: 'GST Verified',      color: 'bg-green-100 text-green-700 border-green-200' },
  IEC_GLOBAL:      { label: 'IEC Export Ready',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  UDYAM_MSME:      { label: 'MSME Registered',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const DOC_LABELS: Record<string, string> = {
  GST_CERTIFICATE: 'GST Certificate',
  PAN_CARD:        'PAN Card',
  IEC_CERTIFICATE: 'IEC Certificate',
  UDYAM:           'Udyam / MSME Certificate',
  ISO:             'ISO Certificate',
  DRUG_LICENCE:    'Drug Licence',
  FSSAI:           'FSSAI Certificate',
  DIRECTOR_PHOTO:  'Director Photo',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Inline Edit Field ────────────────────────────────────────────────────────

function EditField({
  label,
  value,
  name,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  name: string;
  onChange: (name: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(name, e.target.value)}
        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled
            ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200'
            : 'bg-white border-gray-300 text-gray-900'
        }`}
      />
      {disabled && (
        <p className="mt-1 text-xs text-amber-600">Changing this field requires re-verification</p>
      )}
    </div>
  );
}

// ─── KYC Status Badge ─────────────────────────────────────────────────────────

function KycStatusBadge({ status }: { status: string }) {
  const styles = {
    APPROVED: 'bg-green-100 text-green-700 border-green-200',
    PENDING:  'bg-amber-100 text-amber-700 border-amber-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
  }[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';

  const icons = {
    APPROVED: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    PENDING: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    REJECTED: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles}`}>
      {icons}
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SellerProfilePage() {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [resubmitting, setResubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const authHeader = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
    return { Authorization: `Bearer ${token}` };
  }, []);

  // ─── Fetch Profile ──────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/seller/profile`, {
        headers: authHeader(),
      });
      const data: SellerProfile = res.data.data;
      setProfile(data);
      setForm({
        companyName:           data.companyName,
        businessOfficeAddress: data.address.businessOfficeAddress ?? '',
        city:                  data.address.city ?? '',
        state:                 data.address.state ?? '',
        phone:                 data.contact.phone ?? '',
      });
    } catch {
      toast.error('Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ─── Save Profile ───────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      ['companyName', 'businessOfficeAddress', 'city', 'state', 'phone'].forEach((k) => {
        if (form[k] !== undefined) payload[k] = form[k];
      });

      const res = await axios.patch(`${API_BASE}/api/seller/profile`, payload, {
        headers: authHeader(),
      });
      const result = res.data.data;

      if (result?.requiresReKYC) {
        toast.error('These fields require re-verification. Please contact support.');
      } else {
        toast.success('Profile updated successfully');
        setEditMode(false);
        fetchProfile();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!profile) return;
    setForm({
      companyName:           profile.companyName,
      businessOfficeAddress: profile.address.businessOfficeAddress ?? '',
      city:                  profile.address.city ?? '',
      state:                 profile.address.state ?? '',
      phone:                 profile.contact.phone ?? '',
    });
    setEditMode(false);
  };

  // ─── Logo Upload ────────────────────────────────────────────────────────

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB');
      return;
    }

    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API_BASE}/api/upload/seller/logo`, fd, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      const { logoUrl } = res.data.data;
      setProfile((prev) => prev ? { ...prev, logoUrl } : prev);
      toast.success('Logo updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Logo upload failed');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // ─── Re-KYC submission ────────────────────────────────────────────────────

  const handleReVerify = async () => {
    if (!window.confirm('Re-submit your KYC for review? Our team will review it within 2–3 business days.')) return;
    setResubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/seller/kyc/re-submit`,
        {},
        { headers: authHeader() },
      );
      toast.success(res.data.data?.message ?? 'KYC re-submitted successfully');
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Re-submission failed. Please try again.');
    } finally {
      setResubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-36 bg-gray-100 rounded-2xl" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center text-gray-500">
        Profile not found. Please complete your KYC first.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">

      {/* ── Profile Header ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Logo */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            className="group relative w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 overflow-hidden shadow-md hover:shadow-lg transition-shadow"
            title="Click to upload logo"
          >
            {profile.logoUrl ? (
              <img
                src={`${API_BASE}${profile.logoUrl}`}
                alt="Company logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white select-none">
                {profile.companyInitials}
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {logoUploading ? (
                <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
          </button>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          <p className="mt-1 text-center text-xs text-gray-400">Click to upload</p>
        </div>

        {/* Company info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{profile.companyName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profile.companyType.replace(/_/g, ' ')} · Member since{' '}
            {new Date(profile.memberSince).getFullYear()}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {profile.badges.map((b) => {
              const cfg = BADGE_CONFIG[b];
              if (!cfg) return null;
              return (
                <span key={b} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* KYC status + edit button */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <KycStatusBadge status={profile.kycStatus} />
          {profile.kycStatus === 'REJECTED' && (
            <button
              onClick={handleReVerify}
              disabled={resubmitting}
              className="text-xs text-blue-600 hover:underline font-medium disabled:opacity-50"
            >
              {resubmitting ? 'Submitting…' : 'Re-submit KYC →'}
            </button>
          )}
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleDiscard}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Company Information ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Company Information</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Fields marked as restricted require re-verification to change.
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <EditField
            label="Company Name"
            name="companyName"
            value={form.companyName ?? ''}
            onChange={(n, v) => setForm((prev) => ({ ...prev, [n]: v }))}
            disabled={!editMode}
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Company Type</label>
            <input
              type="text"
              value={profile.companyType.replace(/_/g, ' ')}
              disabled
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-amber-600">Changing this field requires re-verification</p>
          </div>
          <EditField
            label="Business Office Address"
            name="businessOfficeAddress"
            value={form.businessOfficeAddress ?? ''}
            onChange={(n, v) => setForm((prev) => ({ ...prev, [n]: v }))}
            disabled={!editMode}
          />
          <EditField
            label="City"
            name="city"
            value={form.city ?? ''}
            onChange={(n, v) => setForm((prev) => ({ ...prev, [n]: v }))}
            disabled={!editMode}
          />
          <EditField
            label="State"
            name="state"
            value={form.state ?? ''}
            onChange={(n, v) => setForm((prev) => ({ ...prev, [n]: v }))}
            disabled={!editMode}
          />
          <EditField
            label="Phone Number"
            name="phone"
            value={form.phone ?? ''}
            onChange={(n, v) => setForm((prev) => ({ ...prev, [n]: v }))}
            disabled={!editMode}
          />
          {/* Read-only */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email Address</label>
            <input
              type="text"
              value={profile.contact.email}
              disabled
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
            <input
              type="text"
              value={profile.address.country}
              disabled
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* ── KYC Details (read-only) ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">KYC & Regulatory Details</h2>
          <p className="text-xs text-gray-500 mt-0.5">These fields are locked post-KYC. Contact support to initiate re-verification.</p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { label: 'GST Number',     value: profile.kyc.gstNumber },
            { label: 'PAN Number',     value: profile.kyc.panNumber },
            { label: 'IEC Code',       value: profile.kyc.iecCode },
            { label: 'Udyam Number',   value: profile.kyc.udyamNumber },
            { label: 'Business Model', value: profile.kyc.businessModel?.replace(/_/g, ' ') },
            { label: 'Director Name',  value: profile.kyc.directorName },
            {
              label: 'Aadhaar (last 4)',
              value: profile.kyc.aadhaarLastFour
                ? `XXXX-XXXX-${profile.kyc.aadhaarLastFour}`
                : null,
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <input
                type="text"
                value={value ?? '—'}
                disabled
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>
          ))}
          {profile.kyc.industryType.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-2">Industry Types</label>
              <div className="flex flex-wrap gap-2">
                {profile.kyc.industryType.map((t) => (
                  <span key={t} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KYC Documents ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">KYC Documents</h2>
            <p className="text-xs text-gray-500 mt-0.5">{profile.documents.length} document(s) uploaded</p>
          </div>
          {profile.kycStatus === 'REJECTED' && (
            <button
              onClick={handleReVerify}
              disabled={resubmitting}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {resubmitting ? 'Submitting…' : 'Re-submit KYC'}
            </button>
          )}
        </div>

        {profile.documents.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">
            No KYC documents found. Complete your seller registration to upload documents.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {profile.documents.map((doc) => (
              <div key={doc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                {/* Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  {doc.mimeType === 'application/pdf' ? (
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {DOC_LABELS[doc.documentType] ?? doc.documentType}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {doc.fileName} · {formatBytes(doc.fileSize)} · Uploaded{' '}
                    {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>

                {/* Status + KYC badge */}
                <KycStatusBadge status={profile.kycStatus} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Rejection Alert ──────────────────────────────────────────────── */}
      {profile.kycStatus === 'REJECTED' && profile.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">KYC Rejected</p>
              <p className="text-sm text-red-700 mt-1">{profile.rejectionReason}</p>
              <button
                onClick={handleReVerify}
                disabled={resubmitting}
                className="mt-3 text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                {resubmitting ? 'Submitting…' : 'Re-submit KYC for review →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
