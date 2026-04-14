/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

// ─── Event types that support per-channel preferences ────────────────────────

const EVENT_TYPES = [
  { key: 'NEW_LEAD',         label: 'New Buy Lead Match',      desc: 'When a new lead matches your products' },
  { key: 'NEW_ORDER',        label: 'New Order / Enquiry',     desc: 'When a buyer places an order or enquiry' },
  { key: 'KYC_STATUS',       label: 'KYC Status Updates',      desc: 'Approval, rejection, or re-verification requests' },
  { key: 'PRODUCT_APPROVED', label: 'Product Approved',        desc: 'When your product listing is approved or rejected' },
  { key: 'LOW_BALANCE',      label: 'Low Credit Balance Alert', desc: 'When your wallet drops below threshold' },
  { key: 'PAYMENT',          label: 'Payment Confirmation',    desc: 'Receipts for wallet recharges' },
] as const;

type EventKey = (typeof EVENT_TYPES)[number]['key'];
type ChannelPrefs = { email?: boolean; sms?: boolean; whatsapp?: boolean };

interface Settings {
  notifications: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    push: boolean;
  };
  eventPreferences: Record<string, ChannelPrefs>;
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      {label && <span className="text-sm text-gray-700 select-none">{label}</span>}
    </label>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Deactivate Modal ─────────────────────────────────────────────────────────

function DeactivateModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (password: string, reason: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { toast.error('Password is required'); return; }
    setLoading(true);
    try {
      await onConfirm(password, reason);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Deactivate Account</h3>
            <p className="text-sm text-gray-500 mt-1">
              This will immediately deactivate your seller account and sign you out of all devices.
              Your data is retained for 90 days and can be reactivated by contacting support.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm your password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us why you're leaving…"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Deactivating…' : 'Deactivate Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SellerSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);

  // Password change form
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const authHeader = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
    return { Authorization: `Bearer ${token}` };
  }, []);

  // ─── Load Settings ──────────────────────────────────────────────────────

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/seller/settings`, { headers: authHeader() })
      .then((res) => setSettings(res.data.data))
      .catch(() => toast.error('Could not load settings'))
      .finally(() => setLoading(false));
  }, [authHeader]);

  // ─── Save notification channel toggle ──────────────────────────────────

  const saveChannelToggle = async (channel: keyof Settings['notifications'], value: boolean) => {
    if (!settings) return;
    const updated = { ...settings, notifications: { ...settings.notifications, [channel]: value } };
    setSettings(updated);
    setSaving(true);
    try {
      await axios.patch(
        `${API_BASE}/api/seller/settings`,
        { [`${channel}Notifications`]: value },
        { headers: authHeader() },
      );
    } catch {
      toast.error('Failed to save setting');
      setSettings(settings); // revert
    } finally {
      setSaving(false);
    }
  };

  // ─── Save per-event preference ──────────────────────────────────────────

  const saveEventPref = async (eventKey: string, ch: keyof ChannelPrefs, value: boolean) => {
    if (!settings) return;
    const prev = settings.eventPreferences[eventKey] ?? {};
    const updated: Settings = {
      ...settings,
      eventPreferences: {
        ...settings.eventPreferences,
        [eventKey]: { ...prev, [ch]: value },
      },
    };
    setSettings(updated);
    try {
      await axios.patch(
        `${API_BASE}/api/seller/settings`,
        { eventPreferences: updated.eventPreferences },
        { headers: authHeader() },
      );
    } catch {
      toast.error('Failed to save preference');
      setSettings(settings);
    }
  };

  // ─── Change password ────────────────────────────────────────────────────

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (pwForm.next.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      await axios.post(
        `${API_BASE}/api/seller/account/change-password`,
        { currentPassword: pwForm.current, newPassword: pwForm.next },
        { headers: authHeader() },
      );
      toast.success('Password changed. Please sign in again.');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/auth/signin');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Password change failed');
    } finally {
      setPwSaving(false);
    }
  };

  // ─── Deactivate ─────────────────────────────────────────────────────────

  const handleDeactivate = async (password: string, reason: string) => {
    try {
      await axios.post(
        `${API_BASE}/api/seller/account/deactivate`,
        { password, reason: reason || undefined },
        { headers: authHeader() },
      );
      toast.success('Account deactivated successfully');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Deactivation failed');
      throw err;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse max-w-3xl mx-auto">
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-96 bg-gray-100 rounded-2xl" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!settings) return null;

  const prefs = settings.eventPreferences;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage notifications, security, and account preferences.</p>
      </div>

      {/* ── Notification Channels ─────────────────────────────────────── */}
      <Section
        title="Notification Channels"
        desc="Choose how you'd like to receive notifications globally."
      >
        <div className="space-y-4">
          {(
            [
              { key: 'email',    label: 'Email Notifications',    desc: `Sent to ${/* filled below */ ''}` },
              { key: 'sms',      label: 'SMS Notifications',       desc: 'Text messages to your registered phone' },
              { key: 'whatsapp', label: 'WhatsApp Notifications',  desc: 'Messages via WhatsApp Business' },
              { key: 'push',     label: 'Push Notifications',      desc: 'In-app and browser push alerts' },
            ] as const
          ).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <Toggle
                checked={settings.notifications[key]}
                onChange={(v) => saveChannelToggle(key, v)}
                disabled={saving}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Per-Event Preferences ─────────────────────────────────────── */}
      <Section
        title="Per-Event Preferences"
        desc="Fine-tune which channels you use for each event type."
      >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-2 pb-3 font-medium">Event</th>
                <th className="text-center px-4 pb-3 font-medium">Email</th>
                <th className="text-center px-4 pb-3 font-medium">SMS</th>
                <th className="text-center px-4 pb-3 font-medium">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {EVENT_TYPES.map(({ key, label, desc }) => {
                const ep = prefs[key] ?? { email: true, sms: false, whatsapp: false };
                return (
                  <tr key={key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-3">
                      <p className="font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        checked={ep.email ?? false}
                        onChange={(v) => saveEventPref(key, 'email', v)}
                        disabled={!settings.notifications.email}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        checked={ep.sms ?? false}
                        onChange={(v) => saveEventPref(key, 'sms', v)}
                        disabled={!settings.notifications.sms}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        checked={ep.whatsapp ?? false}
                        onChange={(v) => saveEventPref(key, 'whatsapp', v)}
                        disabled={!settings.notifications.whatsapp}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-3 px-2">
            Channels disabled globally (above) are greyed out and cannot be enabled per-event.
          </p>
        </div>
      </Section>

      {/* ── Security ─────────────────────────────────────────────────── */}
      <Section title="Security" desc="Manage your password and two-factor authentication.">
        <div className="space-y-6">
          {/* Change password */}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Change Password</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
                <input
                  type="password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
                <input
                  type="password"
                  value={pwForm.next}
                  onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                  placeholder="Min 8 characters"
                  minLength={8}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={pwSaving}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </form>

          {/* 2FA — coming soon */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Two-Factor Authentication</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Add an extra layer of security to your account with OTP verification.
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full border border-gray-200">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border-2 border-red-200">
        <div className="px-6 py-4 border-b border-red-100">
          <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
          <p className="text-xs text-red-400 mt-0.5">
            Actions here are serious and may be irreversible. Proceed with caution.
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Deactivate Account</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Immediately suspends your seller account, hides your listings, and signs you out
                everywhere. Your data is retained for 90 days. Contact support to reactivate.
              </p>
            </div>
            <button
              onClick={() => setShowDeactivate(true)}
              className="flex-shrink-0 px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Deactivate
            </button>
          </div>
        </div>
      </div>

      {/* Deactivate modal */}
      {showDeactivate && (
        <DeactivateModal
          onClose={() => setShowDeactivate(false)}
          onConfirm={handleDeactivate}
        />
      )}
    </div>
  );
}
