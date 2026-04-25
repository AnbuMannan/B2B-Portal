'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

function authHeaders() {
  const t = localStorage.getItem('accessToken');
  return { Authorization: `Bearer ${t}` };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
      {msg}
    </div>
  );
}

export default function BuyerSettingsPage() {
  const router = useRouter();

  // Password change
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdSaving, setPwdSaving] = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const deleting = false;

  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const changePassword = async () => {
    if (pwd.next.length < 8) { showToast('New password must be at least 8 characters'); return; }
    if (pwd.next !== pwd.confirm) { showToast('Passwords do not match'); return; }
    setPwdSaving(true);
    try {
      await axios.post(`${API}/api/buyer/change-password`,
        { currentPassword: pwd.current, newPassword: pwd.next },
        { headers: authHeaders() },
      );
      showToast('Password changed successfully');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Failed to change password');
    } finally { setPwdSaving(false); }
  };

  const signOut = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/auth/signin');
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <Toast msg={toast} />

      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account security and preferences</p>
      </div>

      {/* Change Password */}
      <Section title="Change Password">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
            <input
              type="password"
              value={pwd.current}
              onChange={e => setPwd(p => ({ ...p, current: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
            <input
              type="password"
              value={pwd.next}
              onChange={e => setPwd(p => ({ ...p, next: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pwd.confirm}
              onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Re-enter new password"
            />
          </div>
          <button
            onClick={changePassword}
            disabled={pwdSaving || !pwd.current || !pwd.next || !pwd.confirm}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {pwdSaving ? 'Saving…' : 'Update Password'}
          </button>
        </div>
      </Section>

      {/* Session */}
      <Section title="Session">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Sign out of your account</p>
            <p className="text-xs text-gray-500 mt-0.5">You will be redirected to the login page</p>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </Section>

      {/* Data & Privacy */}
      <Section title="Data &amp; Privacy">
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            Your personal data is protected under the{' '}
            <span className="font-medium text-gray-800">Digital Personal Data Protection Act 2023 (DPDP Act)</span>.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-500">
            <li>We collect only data necessary to provide marketplace services</li>
            <li>Your contact details are shared with sellers only when you reveal a lead</li>
            <li>You can request a data export or deletion at any time</li>
          </ul>
          <p className="text-xs text-gray-500">
            To request data export or account deletion, contact{' '}
            <span className="text-blue-600">support@b2bmarket.in</span>
          </p>
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Deleting your account is permanent and cannot be undone. All your requirements, quotes, and order history will be archived.
          </p>
          <p className="text-xs text-gray-500">
            Type <span className="font-mono font-medium text-red-600">DELETE</span> to confirm
          </p>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-40"
              placeholder="Type DELETE"
            />
            <button
              disabled={deleteConfirm !== 'DELETE' || deleting}
              onClick={() => showToast('Please contact support@b2bmarket.in to delete your account')}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
            >
              {deleting ? 'Processing…' : 'Delete Account'}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
