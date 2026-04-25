'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

function authHeaders() {
  const token = localStorage.getItem('adminAccessToken');
  return { Authorization: `Bearer ${token}` };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
  industryType: string[];
  children?: Category[];
  _count?: { productLinks: number };
}

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceInr: number;
  isActive: boolean;
  sortOrder: number;
}

interface Keyword {
  id: string;
  keyword: string;
  addedAt: string;
}

interface NotificationTemplate {
  id: string;
  key: string;
  titleEn: string;
  bodyEn: string;
  titleHi: string;
  bodyHi: string;
  variables: string[];
  isActive: boolean;
}

// ── Tab: Categories ──────────────────────────────────────────────────────────

function CategoryTree({
  cats,
  depth = 0,
  onEdit,
  onDelete,
}: {
  cats: Category[];
  depth?: number;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  return (
    <ul className={depth === 0 ? '' : 'ml-6 border-l border-gray-200 dark:border-gray-700 pl-3'}>
      {cats.map((cat) => (
        <li key={cat.id} className="mb-1">
          <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
            <div className="flex items-center gap-2">
              {depth > 0 && <span className="text-gray-400 dark:text-gray-500 text-xs">└</span>}
              <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{cat.name}</span>
              {cat._count && cat._count.productLinks > 0 && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                  {cat._count.productLinks} products
                </span>
              )}
              {cat.description && (
                <span className="text-xs text-gray-400 dark:text-gray-500 hidden group-hover:inline">{cat.description}</span>
              )}
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(cat)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
              <button onClick={() => onDelete(cat)} className="text-xs text-red-500 dark:text-red-400 hover:underline">Delete</button>
            </div>
          </div>
          {cat.children && cat.children.length > 0 && (
            <CategoryTree cats={cat.children} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          )}
        </li>
      ))}
    </ul>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ name: '', parentId: '', description: '' });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/admin/categories`, { headers: authHeaders() });
      setCategories(res.data.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: '', parentId: '', description: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setForm({ name: cat.name, parentId: cat.parentId ?? '', description: cat.description ?? '' });
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await axios.delete(`${API}/api/admin/categories/${cat.id}`, { headers: authHeaders() });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Delete failed');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: form.name.trim(), parentId: form.parentId || undefined, description: form.description || undefined };
      if (editTarget) {
        await axios.patch(`${API}/api/admin/categories/${editTarget.id}`, payload, { headers: authHeaders() });
      } else {
        await axios.post(`${API}/api/admin/categories`, payload, { headers: authHeaders() });
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const flatCats: Category[] = [];
  const flatten = (cats: Category[]) => cats.forEach((c) => { flatCats.push(c); if (c.children) flatten(c.children); });
  flatten(categories);

  if (loading) return <div className="text-gray-500 dark:text-gray-400 text-sm py-6">Loading categories…</div>;

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Category Tree</h3>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg">
          + Add Category
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">{editTarget ? 'Edit Category' : 'New Category'}</h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Industrial Machinery" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Parent Category (optional)</label>
              <select value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))} className={inputCls}>
                <option value="">— Root (no parent) —</option>
                {flatCats.filter((c) => c.id !== editTarget?.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Optional short description" />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-600 dark:text-gray-300 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">No categories yet.</p>
      ) : (
        <CategoryTree cats={categories} onEdit={openEdit} onDelete={handleDelete} />
      )}
    </div>
  );
}

// ── Tab: Banners ─────────────────────────────────────────────────────────────

function BannersTab() {
  const [banners, setBanners]     = useState<Banner[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Banner | null>(null);
  const [form, setForm]           = useState({ title: '', imageUrl: '', linkUrl: '', sortOrder: 0, startDate: '', endDate: '' });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/admin/banners`, { headers: authHeaders() });
      setBanners(res.data.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ title: '', imageUrl: '', linkUrl: '', sortOrder: 0, startDate: '', endDate: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (b: Banner) => {
    setEditTarget(b);
    setForm({ title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl ?? '', sortOrder: b.sortOrder, startDate: b.startDate ? b.startDate.slice(0, 10) : '', endDate: b.endDate ? b.endDate.slice(0, 10) : '' });
    setShowForm(true);
    setError('');
  };

  const toggleActive = async (b: Banner) => {
    await axios.patch(`${API}/api/admin/banners/${b.id}`, { isActive: !b.isActive }, { headers: authHeaders() });
    load();
  };

  const handleDelete = async (b: Banner) => {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    await axios.delete(`${API}/api/admin/banners/${b.id}`, { headers: authHeaders() });
    load();
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.imageUrl.trim()) { setError('Title and image URL are required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { title: form.title.trim(), imageUrl: form.imageUrl.trim(), linkUrl: form.linkUrl.trim() || undefined, sortOrder: form.sortOrder, startDate: form.startDate || undefined, endDate: form.endDate || undefined };
      if (editTarget) {
        await axios.patch(`${API}/api/admin/banners/${editTarget.id}`, payload, { headers: authHeaders() });
      } else {
        await axios.post(`${API}/api/admin/banners`, payload, { headers: authHeaders() });
      }
      setShowForm(false); load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-gray-500 dark:text-gray-400 text-sm py-6">Loading banners…</div>;

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Homepage Banners</h3>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg">
          + Add Banner
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">{editTarget ? 'Edit Banner' : 'New Banner'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Title *</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Banner headline" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Image URL *</label>
              <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} className={inputCls} placeholder="https://cdn.example.com/banner.webp" />
              {form.imageUrl && (
                <img src={form.imageUrl} alt="preview" className="mt-2 h-24 object-cover rounded border border-gray-200 dark:border-gray-600" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Link URL (optional)</label>
              <input value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} className={inputCls} placeholder="/category/machinery" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={inputCls} />
            </div>
            {error && <p className="col-span-2 text-red-500 text-xs">{error}</p>}
            <div className="col-span-2 flex gap-2">
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-600 dark:text-gray-300 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {banners.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-sm">No banners yet.</p>}
        {banners.map((b) => (
          <div key={b.id} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg overflow-hidden flex">
            <img
              src={b.imageUrl}
              alt={b.title}
              className="w-40 h-24 object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-700"
              onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9Ijk2IiB2aWV3Qm94PSIwIDAgMTYwIDk2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTYiIGZpbGw9IiNFNUU3RUIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzlDQTNBRiI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'; }}
            />
            <div className="flex-1 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{b.title}</p>
                {b.linkUrl && <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">{b.linkUrl}</p>}
                <div className="flex gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
                  <span>Order: {b.sortOrder}</span>
                  {b.startDate && <span>From {b.startDate.slice(0, 10)}</span>}
                  {b.endDate && <span>Until {b.endDate.slice(0, 10)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActive(b)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${b.isActive ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                >
                  {b.isActive ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => openEdit(b)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
                <button onClick={() => handleDelete(b)} className="text-xs text-red-500 dark:text-red-400 hover:underline">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Credit Packs ────────────────────────────────────────────────────────

function CreditPacksTab() {
  const [packs, setPacks]             = useState<CreditPack[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState<string | null>(null);
  const [editValues, setEditValues]   = useState<Partial<CreditPack>>({});
  const [showCreate, setShowCreate]   = useState(false);
  const [newPack, setNewPack]         = useState({ name: '', credits: '', priceInr: '' });
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/admin/config/credit-packs`, { headers: authHeaders() });
      setPacks(res.data.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (p: CreditPack) => {
    setEditing(p.id);
    setEditValues({ name: p.name, credits: p.credits, priceInr: p.priceInr, sortOrder: p.sortOrder });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await axios.patch(`${API}/api/admin/config/credit-packs/${id}`, editValues, { headers: authHeaders() });
      setEditing(null);
      load();
    } finally { setSaving(false); }
  };

  const toggleActive = async (p: CreditPack) => {
    await axios.patch(`${API}/api/admin/config/credit-packs/${p.id}`, { isActive: !p.isActive }, { headers: authHeaders() });
    load();
  };

  const handleCreate = async () => {
    if (!newPack.name || !newPack.credits || !newPack.priceInr) return;
    setSaving(true);
    try {
      await axios.post(`${API}/api/admin/config/credit-packs`, { name: newPack.name, credits: parseInt(newPack.credits), priceInr: parseInt(newPack.priceInr) }, { headers: authHeaders() });
      setShowCreate(false);
      setNewPack({ name: '', credits: '', priceInr: '' });
      load();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-gray-500 dark:text-gray-400 text-sm py-6">Loading…</div>;

  const perCredit = (p: CreditPack) => (p.priceInr / p.credits).toFixed(1);
  const inputCls = 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm focus:outline-none';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Lead Credit Packs</h3>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg">
          + New Pack
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">New Credit Pack</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Pack Name</label>
              <input value={newPack.name} onChange={(e) => setNewPack((n) => ({ ...n, name: e.target.value }))} className={`${inputCls} w-full`} placeholder="Enterprise" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Credits</label>
              <input type="number" value={newPack.credits} onChange={(e) => setNewPack((n) => ({ ...n, credits: e.target.value }))} className={`${inputCls} w-full`} placeholder="500" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Price (₹)</label>
              <input type="number" value={newPack.priceInr} onChange={(e) => setNewPack((n) => ({ ...n, priceInr: e.target.value }))} className={`${inputCls} w-full`} placeholder="6999" />
            </div>
            <div className="col-span-3 flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50">{saving ? 'Saving…' : 'Create'}</button>
              <button onClick={() => setShowCreate(false)} className="text-sm text-gray-600 dark:text-gray-300 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Pack Name</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Credits</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Price (₹)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">₹/Credit</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {packs.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                <td className="px-4 py-3">
                  {editing === p.id ? (
                    <input value={editValues.name ?? ''} onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))} className={`${inputCls} w-full`} />
                  ) : (
                    <span className="font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {editing === p.id ? (
                    <input type="number" value={editValues.credits ?? ''} onChange={(e) => setEditValues((v) => ({ ...v, credits: parseInt(e.target.value) }))} className={`${inputCls} w-24`} />
                  ) : p.credits}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {editing === p.id ? (
                    <input type="number" value={editValues.priceInr ?? ''} onChange={(e) => setEditValues((v) => ({ ...v, priceInr: parseInt(e.target.value) }))} className={`${inputCls} w-28`} />
                  ) : `₹${p.priceInr.toLocaleString('en-IN')}`}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">₹{perCredit(p)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(p)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${p.isActive ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                  >
                    {p.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {editing === p.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(p.id)} disabled={saving} className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">Save</button>
                      <button onClick={() => setEditing(null)} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(p)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Prohibited Keywords ─────────────────────────────────────────────────

function KeywordsTab() {
  const [data, setData]         = useState<{ items: Keyword[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading]   = useState(true);
  const [newKw, setNewKw]       = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [page]                  = useState(1);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');

  const load = useCallback(async (p = page) => {
    try {
      const res = await axios.get(`${API}/api/admin/config/prohibited-keywords?page=${p}&limit=50`, { headers: authHeaders() });
      setData(res.data.data);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const addOne = async () => {
    if (!newKw.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/api/admin/config/prohibited-keywords`, { keyword: newKw.trim() }, { headers: authHeaders() });
      setNewKw('');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Failed');
    } finally { setSaving(false); }
  };

  const addBulk = async () => {
    const keywords = bulkText.split('\n').map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return;
    setSaving(true);
    try {
      const res = await axios.post(`${API}/api/admin/config/prohibited-keywords/bulk`, { keywords }, { headers: authHeaders() });
      const { created, skipped } = res.data.data;
      alert(`Added ${created} keywords. ${skipped} already existed.`);
      setBulkText('');
      setShowBulk(false);
      load();
    } finally { setSaving(false); }
  };

  const remove = async (kw: Keyword) => {
    if (!confirm(`Remove keyword "${kw.keyword}"?`)) return;
    await axios.delete(`${API}/api/admin/config/prohibited-keywords/${kw.id}`, { headers: authHeaders() });
    load();
  };

  const filtered = data.items.filter((k) => k.keyword.includes(search.toLowerCase()));

  if (loading) return <div className="text-gray-500 dark:text-gray-400 text-sm py-6">Loading…</div>;

  const inputCls = 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm focus:outline-none';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">
          Prohibited Keywords <span className="text-gray-400 dark:text-gray-500 font-normal text-sm">({data.total} total)</span>
        </h3>
        <button onClick={() => setShowBulk(!showBulk)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Bulk Import</button>
      </div>

      {showBulk && (
        <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">One keyword per line:</p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            className={`${inputCls} w-full font-mono`}
            placeholder={'fake invoice\ncounterfeit\npirated goods'}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={addBulk} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-4 py-2 rounded disabled:opacity-50">{saving ? 'Adding…' : 'Add All'}</button>
            <button onClick={() => setShowBulk(false)} className="text-sm text-gray-600 dark:text-gray-300 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOne()}
          className={`${inputCls} flex-1`}
          placeholder="Type keyword and press Enter or Add"
        />
        <button onClick={addOne} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50">
          {saving ? '…' : 'Add'}
        </button>
      </div>

      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} w-64`}
          placeholder="Filter keywords…"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filtered.map((kw) => (
          <span key={kw.id} className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs px-3 py-1.5 rounded-full">
            {kw.keyword}
            <button onClick={() => remove(kw)} className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300 ml-1 font-bold leading-none">×</button>
          </span>
        ))}
        {filtered.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-sm">No keywords match.</p>}
      </div>
    </div>
  );
}

// ── Tab: Notification Templates ──────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<NotificationTemplate | null>(null);
  const [lang, setLang]           = useState<'en' | 'hi'>('en');
  const [form, setForm]           = useState({ titleEn: '', bodyEn: '', titleHi: '', bodyHi: '' });
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState('');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/admin/config/notification-templates`, { headers: authHeaders() });
      setTemplates(res.data.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectTemplate = (t: NotificationTemplate) => {
    setSelected(t);
    setForm({ titleEn: t.titleEn, bodyEn: t.bodyEn, titleHi: t.titleHi, bodyHi: t.bodyHi });
    setSuccess('');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/api/admin/config/notification-templates/${selected.key}`, form, { headers: authHeaders() });
      setSuccess('Saved!');
      load();
      setTimeout(() => setSuccess(''), 3000);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-gray-500 dark:text-gray-400 text-sm py-6">Loading…</div>;

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="flex gap-6">
      {/* Template list */}
      <div className="w-64 flex-shrink-0">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Templates</h4>
        <ul className="space-y-1">
          {templates.map((t) => (
            <li key={t.key}>
              <button
                onClick={() => selectTemplate(t)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selected?.key === t.key
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="block font-medium">{t.key}</span>
                {t.variables.length > 0 && (
                  <span className={`text-xs ${selected?.key === t.key ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    {'{{'}{t.variables.join('}}, {{')}{'}}'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Editor */}
      <div className="flex-1">
        {!selected ? (
          <div className="text-gray-400 dark:text-gray-500 text-sm pt-8 text-center">Select a template to edit</div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200">{selected.key}</h4>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setLang('en')}
                  className={`text-sm px-3 py-1 rounded transition-colors ${lang === 'en' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  English
                </button>
                <button
                  onClick={() => setLang('hi')}
                  className={`text-sm px-3 py-1 rounded transition-colors ${lang === 'hi' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  हिंदी
                </button>
              </div>
            </div>

            {selected.variables.length > 0 && (
              <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Available placeholders: {selected.variables.map((v) => `{{${v}}}`).join(', ')}
              </div>
            )}

            {lang === 'en' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Title (English)</label>
                  <input value={form.titleEn} onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Body (English)</label>
                  <textarea value={form.bodyEn} onChange={(e) => setForm((f) => ({ ...f, bodyEn: e.target.value }))} rows={5} className={`${inputCls} resize-none`} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">शीर्षक (हिंदी)</label>
                  <input value={form.titleHi} onChange={(e) => setForm((f) => ({ ...f, titleHi: e.target.value }))} className={inputCls} dir="auto" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">संदेश (हिंदी)</label>
                  <textarea value={form.bodyHi} onChange={(e) => setForm((f) => ({ ...f, bodyHi: e.target.value }))} rows={5} className={`${inputCls} resize-none`} dir="auto" />
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="mt-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Preview</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {lang === 'en' ? form.titleEn : form.titleHi}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {lang === 'en' ? form.bodyEn : form.bodyHi}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Template'}
              </button>
              {success && <span className="text-green-600 dark:text-green-400 text-sm font-medium">{success}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'categories', label: 'Categories' },
  { id: 'banners',    label: 'Banners' },
  { id: 'credit-packs', label: 'Credit Packs' },
  { id: 'keywords',   label: 'Prohibited Keywords' },
  { id: 'templates',  label: 'Notification Templates' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AdminContentPage() {
  const [tab, setTab] = useState<TabId>('categories');

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Content & Configuration</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage categories, banners, pricing, content moderation, and notification copy</p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 mb-6 w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          {tab === 'categories'   && <CategoriesTab />}
          {tab === 'banners'      && <BannersTab />}
          {tab === 'credit-packs' && <CreditPacksTab />}
          {tab === 'keywords'     && <KeywordsTab />}
          {tab === 'templates'    && <TemplatesTab />}
        </div>
      </div>
    </AdminShell>
  );
}
