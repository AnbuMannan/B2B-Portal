'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface User {
  id: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  adminRole: string | null;
  isActive: boolean;
  phoneVerified: boolean;
  twoFaEnabled: boolean;
  createdAt: string;
  sellers: { id: string; companyName: string; kycStatus: string }[];
  buyers: { id: string }[];
  _count: { auditLogs: number; reportedTickets: number };
}

interface Stats {
  total: number;
  sellers: number;
  buyers: number;
  admins: number;
  inactive: number;
  newThisMonth: number;
}

interface EditForm {
  role: string;
  adminRole: string;
  isActive: boolean;
  phoneVerified: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  SELLER: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  BUYER:  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  ADMIN:  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
};
const ADMIN_ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  ADMIN:       'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  REVIEWER:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
  FINANCE:     'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  SUPPORT:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [stats, setStats]           = useState<Stats | null>(null);
  const [users, setUsers]           = useState<User[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<User | null>(null);
  const [editMode, setEditMode]     = useState(false);
  const [editForm, setEditForm]     = useState<EditForm>({ role: '', adminRole: '', isActive: true, phoneVerified: false });
  const [pwdModal, setPwdModal]     = useState(false);
  const [newPwd, setNewPwd]         = useState('');
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState('');

  const limit = 20;

  const headers = () => {
    const t = localStorage.getItem('adminAccessToken');
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchStats = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/admin/users/stats`, { headers: headers() });
      setStats(r.data.data);
    } catch { /* silent */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search)       params.search = search;
      if (roleFilter)   params.role = roleFilter;
      if (activeFilter) params.isActive = activeFilter;
      const r = await axios.get(`${API}/api/admin/users`, { headers: headers(), params });
      setUsers(r.data.data.items);
      setTotal(r.data.data.total);
    } catch (e: unknown) {
      if ((e as {response?: {status?: number}}).response?.status === 401) router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, roleFilter, activeFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openEdit = (u: User) => {
    setSelected(u);
    setEditForm({ role: u.role, adminRole: u.adminRole ?? '', isActive: u.isActive, phoneVerified: u.phoneVerified });
    setEditMode(true);
    setPwdModal(false);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        role: editForm.role,
        isActive: editForm.isActive,
        phoneVerified: editForm.phoneVerified,
      };
      if (editForm.adminRole !== undefined) {
        payload.adminRole = editForm.adminRole === '' ? null : editForm.adminRole;
      }
      await axios.patch(`${API}/api/admin/users/${selected.id}`, payload, { headers: headers() });
      showToast('User updated successfully');
      setEditMode(false);
      setSelected(null);
      fetchUsers();
      fetchStats();
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      const ep = u.isActive ? 'deactivate' : 'reactivate';
      await axios.post(`${API}/api/admin/users/${u.id}/${ep}`, {}, { headers: headers() });
      showToast(u.isActive ? 'User deactivated' : 'User reactivated');
      fetchUsers();
      fetchStats();
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Action failed');
    }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/api/admin/users/${u.id}`, { headers: headers() });
      showToast('User deleted');
      fetchUsers();
      fetchStats();
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Delete failed');
    }
  };

  const resetPassword = async () => {
    if (!selected || newPwd.length < 8) return;
    setSaving(true);
    try {
      await axios.post(`${API}/api/admin/users/${selected.id}/reset-password`, { newPassword: newPwd }, { headers: headers() });
      showToast('Password reset successfully');
      setPwdModal(false);
      setNewPwd('');
      setSelected(null);
    } catch (e: unknown) {
      showToast((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminShell>
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Users</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage all platform users</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total',       value: stats.total,        color: 'text-gray-900 dark:text-gray-100' },
            { label: 'Sellers',     value: stats.sellers,      color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Buyers',      value: stats.buyers,       color: 'text-green-600 dark:text-green-400' },
            { label: 'Admins',      value: stats.admins,       color: 'text-purple-600 dark:text-purple-400' },
            { label: 'Inactive',    value: stats.inactive,     color: 'text-red-600 dark:text-red-400' },
            { label: 'New (month)', value: stats.newThisMonth, color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Search email or phone…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Roles</option>
          <option value="SELLER">Seller</option>
          <option value="BUYER">Buyer</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value); setPage(1); }}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <span className="text-gray-500 dark:text-gray-400 text-sm ml-auto">{total} users</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-transparent">
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Company / Profile</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                  </td></tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{u.email}</div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs">{u.phoneNumber ?? '—'} {u.phoneVerified && <span className="text-green-500">✓</span>}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {u.role}
                    </span>
                    {u.adminRole && (
                      <span className={`ml-1 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ADMIN_ROLE_COLORS[u.adminRole] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {u.adminRole}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">
                    {u.sellers[0]?.companyName ?? (u.buyers.length ? 'Buyer profile' : '—')}
                    {u.sellers[0] && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${u.sellers[0].kycStatus === 'APPROVED' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'}`}>
                        KYC: {u.sellers[0].kycStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {u.twoFaEnabled && <span className="ml-1 text-xs text-blue-500">2FA</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-400 text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(u)}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                        Edit
                      </button>
                      <button onClick={() => toggleActive(u)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${u.isActive ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                        {u.isActive ? 'Suspend' : 'Restore'}
                      </button>
                      <button onClick={() => { setSelected(u); setPwdModal(true); setEditMode(false); }}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded transition-colors">
                        Pwd
                      </button>
                      <button onClick={() => deleteUser(u)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Page {page} of {totalPages} ({total} total)</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                Previous
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editMode && selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit User</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{selected.email}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
                <select value={editForm.role}
                  onChange={e => setEditForm((f: EditForm) => ({ ...f, role: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="BUYER">Buyer</option>
                  <option value="SELLER">Seller</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Admin Role (leave blank for none)</label>
                <select value={editForm.adminRole ?? ''}
                  onChange={e => setEditForm((f: EditForm) => ({ ...f, adminRole: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— None —</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="REVIEWER">Reviewer</option>
                  <option value="FINANCE">Finance</option>
                  <option value="SUPPORT">Support</option>
                </select>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.isActive}
                    onChange={e => setEditForm((f: EditForm) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded text-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.phoneVerified}
                    onChange={e => setEditForm((f: EditForm) => ({ ...f, phoneVerified: e.target.checked }))}
                    className="rounded text-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Phone Verified</span>
                </label>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div className="flex justify-between"><span>Audit logs</span><span className="text-gray-800 dark:text-gray-200">{selected._count.auditLogs}</span></div>
                <div className="flex justify-between"><span>Complaints filed</span><span className="text-gray-800 dark:text-gray-200">{selected._count.reportedTickets}</span></div>
                <div className="flex justify-between"><span>2FA</span><span className={selected.twoFaEnabled ? 'text-green-600' : 'text-gray-400'}>{selected.twoFaEnabled ? 'Enabled' : 'Disabled'}</span></div>
                <div className="flex justify-between"><span>User ID</span><span className="font-mono text-gray-400 text-xs">{selected.id}</span></div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => { setEditMode(false); setSelected(null); }}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {pwdModal && selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reset Password</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{selected.email}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">New Password (min 8 chars)</label>
                <input type="password" value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">This will immediately replace the user&apos;s password.</p>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => { setPwdModal(false); setNewPwd(''); setSelected(null); }}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={resetPassword} disabled={saving || newPwd.length < 8}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminShell>
  );
}
