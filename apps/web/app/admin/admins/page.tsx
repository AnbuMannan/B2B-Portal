'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('adminAccessToken')}` });

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  ADMIN:       'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  REVIEWER:    'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
  FINANCE:     'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300',
  SUPPORT:     'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
};

interface AdminAccount {
  id: string;
  email: string;
  adminRole: string | null;
  isActive: boolean;
  createdAt: string;
  twoFaEnabled: boolean;
}

export default function AdminAccountsPage() {
  const [admins, setAdmins]     = useState<AdminAccount[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [form, setForm]         = useState({ email: '', password: '', adminRole: 'REVIEWER' });
  const [editForm, setEditForm] = useState({ adminRole: '', isActive: true });
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/dashboard/admin-accounts`, { headers: headers() });
      setAdmins(res.data.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAdmin = async () => {
    if (!form.email || form.password.length < 8) return;
    setSaving(true);
    try {
      await axios.post(`${API}/api/admin/dashboard/admin-accounts`, form, { headers: headers() });
      showToast('Admin account created');
      setModal(null);
      setForm({ email: '', password: '', adminRole: 'REVIEWER' });
      load();
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Create failed');
    } finally { setSaving(false); }
  };

  const updateAdmin = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/api/admin/dashboard/admin-accounts/${selected.id}`, editForm, { headers: headers() });
      showToast('Admin updated');
      setModal(null);
      setSelected(null);
      load();
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Update failed');
    } finally { setSaving(false); }
  };

  const revokeAdmin = async (a: AdminAccount) => {
    if (!confirm(`Revoke admin access for ${a.email}?`)) return;
    try {
      await axios.delete(`${API}/api/admin/dashboard/admin-accounts/${a.id}`, { headers: headers() });
      showToast('Access revoked');
      load();
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Revoke failed');
    }
  };

  const openEdit = (a: AdminAccount) => {
    setSelected(a);
    setEditForm({ adminRole: a.adminRole ?? '', isActive: a.isActive });
    setModal('edit');
  };

  return (
    <AdminShell>
      <div className="p-6 space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Accounts</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage who has admin portal access</p>
          </div>
          <button onClick={() => setModal('create')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
            + New Admin
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-transparent">
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">2FA</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-2/3" />
                  </td></tr>
                ))
              ) : admins.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">No admin accounts found</td></tr>
              ) : admins.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{a.email}</td>
                  <td className="px-4 py-3">
                    {a.adminRole ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[a.adminRole] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        {a.adminRole}
                      </span>
                    ) : <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${a.isActive ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${a.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${a.twoFaEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
                      {a.twoFaEnabled ? 'Enabled' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-400 text-xs">
                    {new Date(a.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(a)}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                        Edit
                      </button>
                      {a.adminRole !== 'SUPER_ADMIN' && (
                        <button onClick={() => revokeAdmin(a)}
                          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create Modal */}
        {modal === 'create' && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Admin Account</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
                  <input type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="admin@company.in" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Password (min 8 chars)</label>
                  <input type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Admin Role</label>
                  <select value={form.adminRole}
                    onChange={e => setForm(f => ({ ...f, adminRole: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="REVIEWER">Reviewer</option>
                    <option value="SUPPORT">Support</option>
                    <option value="FINANCE">Finance</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
              </div>
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
                <button onClick={() => setModal(null)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button onClick={createAdmin} disabled={saving || !form.email || form.password.length < 8}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {modal === 'edit' && selected && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-2xl">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Admin</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{selected.email}</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
                  <select value={editForm.adminRole}
                    onChange={e => setEditForm(f => ({ ...f, adminRole: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="REVIEWER">Reviewer</option>
                    <option value="SUPPORT">Support</option>
                    <option value="FINANCE">Finance</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.isActive}
                    onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="rounded text-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
                <button onClick={() => { setModal(null); setSelected(null); }}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button onClick={updateAdmin} disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
