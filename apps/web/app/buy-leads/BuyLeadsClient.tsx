'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/homepage/Header';
import Footer from '../../components/homepage/Footer';
import { LeadCard } from './components/LeadCard';
import { RevealModal } from './components/RevealModal';
import { CreditWidget } from './components/CreditWidget';
import { MyRevealedLeads } from './components/MyRevealedLeads';
import { SavedLeads } from './components/SavedLeads';
import {
  Search, ChevronDown, Sparkles, SlidersHorizontal, X, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export interface BuyLead {
  id: string;
  productName: string;
  quantity: number | null;
  unit: string | null;
  expectedCountry: string;
  contactChannel: 'WHATSAPP' | 'EMAIL' | 'TELEGRAM';
  repeatOption: 'NONE' | 'WEEKLY' | 'MONTHLY';
  isOpen: boolean;
  postedAt: string;
  expiryDate: string | null;
  buyerMasked: string;
  // extended fields
  requirementType?: 'RETAIL' | 'WHOLESALE' | null;
  currency?: 'INR' | 'USD';
  targetPriceMin?: number | null;
  targetPriceMax?: number | null;
  deliveryState?: string | null;
  categoryId?: string | null;
  isGstVerified?: boolean;
  isExpiringSoon?: boolean;
  revealed?: boolean;
  isMatched?: boolean;
}

export interface RevealedContact {
  id: string;
  buyLeadId: string;
  buyerPhoneNumber: string;
  buyerEmail: string;
  buyerWhatsapp: string;
  buyerGstin: string | null;
  revealedAt: string;
  alreadyRevealed?: boolean;
  convertedToOrder?: boolean;
  convertedAt?: string | null;
  lead?: BuyLead;
}

interface LeadsResponse {
  leads: BuyLead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasCategories?: boolean;
  newSinceLastLogin?: number;
}

interface Category { id: string; name: string; parentId: string | null; }

// ── Constants ──────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
];

const CHANNEL_OPTIONS = ['WHATSAPP', 'TELEGRAM', 'EMAIL'] as const;
const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: 'WhatsApp', TELEGRAM: 'Telegram', EMAIL: 'Email' };

type ActiveTab = 'active' | 'matched' | 'saved' | 'revealed';

// ── Filter defaults ────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  productName: '',
  country: '',
  deliveryState: [] as string[],
  period: 'all' as string,
  requirementType: '' as string,
  qtyMin: '',
  qtyMax: '',
  newOnly: false,
  revealStatus: 'all' as string,
  buyerVerified: false,
  categories: [] as string[],
  contactChannel: [] as string[],
  expiry: 'all' as string,
  priceMin: '',
  priceMax: '',
  priceCurrency: 'INR' as 'INR' | 'USD',
};

type Filters = typeof DEFAULT_FILTERS;

function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded?.role ?? null;
  } catch { return null; }
}

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.productName) n++;
  if (f.country) n++;
  if (f.deliveryState.length) n++;
  if (f.period !== 'all') n++;
  if (f.requirementType) n++;
  if (f.qtyMin || f.qtyMax) n++;
  if (f.newOnly) n++;
  if (f.revealStatus !== 'all') n++;
  if (f.buyerVerified) n++;
  if (f.categories.length) n++;
  if (f.contactChannel.length) n++;
  if (f.expiry !== 'all') n++;
  if (f.priceMin || f.priceMax) n++;
  return n;
}

function filtersToParams(f: Filters, page: number): URLSearchParams {
  const p = new URLSearchParams({ page: String(page), limit: '20' });
  if (f.productName) p.set('productName', f.productName);
  if (f.country) p.set('country', f.country);
  f.deliveryState.forEach((s) => p.append('deliveryState', s));
  if (f.period !== 'all') p.set('period', f.period);
  if (f.requirementType) p.set('requirementType', f.requirementType);
  if (f.qtyMin) p.set('qtyMin', f.qtyMin);
  if (f.qtyMax) p.set('qtyMax', f.qtyMax);
  if (f.newOnly) p.set('newOnly', 'true');
  if (f.revealStatus !== 'all') p.set('revealStatus', f.revealStatus);
  if (f.buyerVerified) p.set('buyerVerified', 'true');
  f.categories.forEach((c) => p.append('categories', c));
  f.contactChannel.forEach((c) => p.append('contactChannel', c));
  if (f.expiry !== 'all') p.set('expiry', f.expiry);
  if (f.priceMin) p.set('priceMin', f.priceMin);
  if (f.priceMax) p.set('priceMax', f.priceMax);
  if (f.priceCurrency !== 'INR') p.set('priceCurrency', f.priceCurrency);
  return p;
}

function urlToFilters(sp: URLSearchParams): Filters {
  return {
    productName: sp.get('productName') ?? '',
    country: sp.get('country') ?? '',
    deliveryState: sp.getAll('deliveryState'),
    period: sp.get('period') ?? 'all',
    requirementType: sp.get('requirementType') ?? '',
    qtyMin: sp.get('qtyMin') ?? '',
    qtyMax: sp.get('qtyMax') ?? '',
    newOnly: sp.get('newOnly') === 'true',
    revealStatus: sp.get('revealStatus') ?? 'all',
    buyerVerified: sp.get('buyerVerified') === 'true',
    categories: sp.getAll('categories'),
    contactChannel: sp.getAll('contactChannel'),
    expiry: sp.get('expiry') ?? 'all',
    priceMin: sp.get('priceMin') ?? '',
    priceMax: sp.get('priceMax') ?? '',
    priceCurrency: (sp.get('priceCurrency') as 'INR' | 'USD') ?? 'INR',
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BuyLeadsClient({ hideShell = false }: { hideShell?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [leads, setLeads] = useState<BuyLead[]>([]);
  const [matchedLeads, setMatchedLeads] = useState<BuyLead[]>([]);
  const [matchedTotal, setMatchedTotal] = useState(0);
  const [matchedPage, setMatchedPage] = useState(1);
  const [matchedTotalPages, setMatchedTotalPages] = useState(1);
  const [hasCategories, setHasCategories] = useState(true);

  const [revealedLeadIds, setRevealedLeadIds] = useState<Set<string>>(new Set());
  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(false);
  const [isMatchedLoading, setIsMatchedLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [newSinceLastLogin, setNewSinceLastLogin] = useState(0);

  // Filter state — initialized from URL
  const [filters, setFilters] = useState<Filters>(() => urlToFilters(searchParams));
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filterCategories, setFilterCategories] = useState<Category[]>([]);

  // Reveal modal
  const [revealingLead, setRevealingLead] = useState<BuyLead | null>(null);
  const [revealedContact, setRevealedContact] = useState<RevealedContact | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  // Wallet
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/auth/signin?returnUrl=/buy-leads'); return; }
    const role = decodeJwtRole(token);
    if (role !== 'SELLER') { toast.error('Buy leads are for registered sellers only.'); router.replace('/'); return; }
    setAccessToken(token);
    setAuthLoading(false);
  }, [router]);

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async (pageNum = 1, reset = false, f?: Filters) => {
    if (!accessToken) return;
    setIsLoading(true);
    const activeFilters = f ?? filters;
    const params = filtersToParams(activeFilters, pageNum);

    // Sync filters to URL (replace, not push, so back button works)
    router.replace(`?${params.toString()}`, { scroll: false });

    try {
      const res = await fetch(`${API_BASE}/api/buy-leads?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to load leads');

      const data: LeadsResponse = json.data;
      setLeads(reset ? data.leads : (prev) => [...prev, ...data.leads]);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(pageNum);
      if (data.newSinceLastLogin !== undefined) setNewSinceLastLogin(data.newSinceLastLogin);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, filters, router]);

  const fetchMatchedLeads = useCallback(async (pageNum = 1, reset = false) => {
    if (!accessToken) return;
    setIsMatchedLoading(true);
    const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
    try {
      const res = await fetch(`${API_BASE}/api/seller/matched-leads?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to load matched leads');
      const data: LeadsResponse = json.data;
      setMatchedLeads(reset ? data.leads : (prev) => [...prev, ...data.leads]);
      setMatchedTotal(data.total);
      setMatchedTotalPages(data.totalPages);
      setMatchedPage(pageNum);
      setHasCategories(data.hasCategories ?? true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load matched leads');
    } finally {
      setIsMatchedLoading(false);
    }
  }, [accessToken]);

  const fetchRevealedIds = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/buy-leads/my-revealed?limit=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (res.ok && json.data?.reveals) {
        setRevealedLeadIds(new Set<string>((json.data.reveals as RevealedContact[]).map((r) => r.buyLeadId)));
      }
    } catch { /* non-critical */ }
  }, [accessToken]);

  const fetchSavedIds = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/seller/leads/saved-ids`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (res.ok && json.data?.ids) setSavedLeadIds(new Set<string>(json.data.ids));
    } catch { /* non-critical */ }
  }, [accessToken]);

  const fetchFilterCategories = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/buy-leads/filter-categories`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (res.ok) setFilterCategories(json.data ?? []);
    } catch { /* non-critical */ }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      fetchLeads(1, true);
      fetchRevealedIds();
      fetchSavedIds();
      fetchFilterCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (activeTab === 'matched' && accessToken && matchedLeads.length === 0) {
      fetchMatchedLeads(1, true);
    }
  }, [activeTab, accessToken, matchedLeads.length, fetchMatchedLeads]);

  // ── Filter change → debounced fetch ────────────────────────────────────────

  const applyFilters = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setLeads([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLeads(1, true, newFilters);
    }, 300);
  }, [fetchLeads]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    applyFilters({ ...filters, [key]: value });
  };

  const clearAllFilters = () => applyFilters({ ...DEFAULT_FILTERS });

  // ── Toggle helpers ──────────────────────────────────────────────────────────

  const toggleArrayFilter = (key: 'categories' | 'contactChannel' | 'deliveryState', value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    applyFilters({ ...filters, [key]: next });
  };

  // ── Save / Reveal ───────────────────────────────────────────────────────────

  const handleToggleSave = useCallback(async (lead: BuyLead) => {
    if (!accessToken) return;
    const wasSaved = savedLeadIds.has(lead.id);
    setSavedLeadIds((prev) => { const s = new Set(Array.from(prev)); wasSaved ? s.delete(lead.id) : s.add(lead.id); return s; });
    try {
      const res = await fetch(`${API_BASE}/api/seller/leads/${lead.id}/save`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed');
      toast.success(json.data?.saved ? 'Lead saved' : 'Lead removed from watchlist');
    } catch {
      setSavedLeadIds((prev) => { const s = new Set(Array.from(prev)); wasSaved ? s.add(lead.id) : s.delete(lead.id); return s; });
      toast.error('Failed to update watchlist');
    }
  }, [accessToken, savedLeadIds]);

  const handleRevealRequest = async (lead: BuyLead) => {
    setRevealingLead(lead);
    setRevealedContact(null);
    if (revealedLeadIds.has(lead.id) && accessToken) {
      setIsRevealing(true);
      try {
        const res = await fetch(`${API_BASE}/api/buy-leads/${lead.id}/reveal`, {
          method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (res.ok) setRevealedContact(json.data as RevealedContact);
        else toast.error(json.message ?? 'Failed to load contact');
      } catch { toast.error('Failed to load contact details'); }
      finally { setIsRevealing(false); }
    }
  };

  const handleConfirmReveal = async () => {
    if (!revealingLead || !accessToken) return;
    setIsRevealing(true);
    try {
      const res = await fetch(`${API_BASE}/api/buy-leads/${revealingLead.id}/reveal`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        const code = json.error?.code ?? json.data?.code;
        if (code === 'INSUFFICIENT_CREDITS') { toast.error('Insufficient credits. Recharge your wallet.'); setRevealingLead(null); return; }
        throw new Error(json.message ?? 'Failed');
      }
      setRevealedContact(json.data as RevealedContact);
      setRevealedLeadIds((prev) => { const s = new Set(Array.from(prev)); s.add(revealingLead.id); return s; });
      setWalletRefreshKey((k) => k + 1);
      if (!json.data.alreadyRevealed) toast.success('Contact revealed! 1 credit deducted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reveal contact');
    } finally { setIsRevealing(false); }
  };

  // ── Loading guard ───────────────────────────────────────────────────────────

  if (authLoading) {
    const spinner = <div className="flex flex-1 items-center justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
    if (hideShell) return spinner;
    return <div className="flex min-h-screen flex-col"><Header /><main className="flex flex-1 items-center justify-center">{spinner}</main><Footer /></div>;
  }

  // ── Lead grid ───────────────────────────────────────────────────────────────

  const renderLeadGrid = (items: BuyLead[], loading: boolean, emptyMsg: string) => {
    if (loading && items.length === 0) {
      return <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 animate-pulse rounded-xl bg-gray-200" />)}</div>;
    }
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-lg font-semibold text-gray-700">{emptyMsg}</p>
          <p className="mt-1 text-sm text-gray-400">Check back later or adjust your filters.</p>
        </div>
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            isRevealed={revealedLeadIds.has(lead.id)}
            isMatched={lead.isMatched}
            isSaved={savedLeadIds.has(lead.id)}
            onReveal={() => handleRevealRequest(lead)}
            onToggleSave={() => handleToggleSave(lead)}
            accessToken={accessToken ?? undefined}
          />
        ))}
      </div>
    );
  };

  // ── Active filter count & pill ──────────────────────────────────────────────

  const activeFilterCount = countActiveFilters(filters);
  const isDomestic = filters.country === 'domestic' || filters.country === 'India';

  // ── Filter bar ──────────────────────────────────────────────────────────────

  const filterBar = (
    <div className="mb-6 rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
      {/* Basic row */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search product name…"
            value={filters.productName}
            onChange={(e) => updateFilter('productName', e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Country quick toggles */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[
            { label: 'All', value: '' },
            { label: '🇮🇳 Domestic', value: 'domestic' },
            { label: '🌍 International', value: 'international' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateFilter('country', opt.value)}
              className={`px-3 py-2 transition-colors ${filters.country === opt.value ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Period */}
        <div className="relative">
          <select
            value={filters.period}
            onChange={(e) => updateFilter('period', e.target.value)}
            className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        {/* More Filters button */}
        <button
          onClick={() => setFiltersExpanded((v) => !v)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${filtersExpanded ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          More Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Clear all */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {filtersExpanded && (
        <div className="border-t border-gray-100 p-4 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">

            {/* Category */}
            {filterCategories.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {filterCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => toggleArrayFilter('categories', cat.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${filters.categories.includes(cat.id) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:border-primary/40'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Requirement Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Requirement Type</label>
              <div className="flex gap-1.5">
                {[
                  { label: 'All', value: '' },
                  { label: 'Retail', value: 'RETAIL' },
                  { label: 'Wholesale', value: 'WHOLESALE' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter('requirementType', opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filters.requirementType === opt.value ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:border-primary/40'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Range */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Quantity Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.qtyMin}
                  min={0}
                  onChange={(e) => applyFilters({ ...filters, qtyMin: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
                <span className="text-gray-400 text-sm">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.qtyMax}
                  min={0}
                  onChange={(e) => applyFilters({ ...filters, qtyMax: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Contact Channel */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Contact Channel</label>
              <div className="flex gap-1.5">
                {CHANNEL_OPTIONS.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => toggleArrayFilter('contactChannel', ch)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filters.contactChannel.includes(ch) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:border-primary/40'}`}
                  >
                    {CHANNEL_LABEL[ch]}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Expiry</label>
              <div className="flex gap-1.5">
                {[{ label: 'All', value: 'all' }, { label: 'In 3 Days', value: '3d' }, { label: 'This Week', value: '7d' }].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter('expiry', opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filters.expiry === opt.value ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:border-primary/40'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Target Price
                <span className="ml-2 inline-flex gap-1 text-xs font-normal">
                  {(['INR', 'USD'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => applyFilters({ ...filters, priceCurrency: c })}
                      className={`rounded px-1.5 py-0.5 transition-colors ${filters.priceCurrency === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {c === 'INR' ? '₹' : '$'}
                    </button>
                  ))}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.priceMin}
                  min={0}
                  onChange={(e) => applyFilters({ ...filters, priceMin: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
                <span className="text-gray-400 text-sm">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.priceMax}
                  min={0}
                  onChange={(e) => applyFilters({ ...filters, priceMax: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Buyer Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Buyer Type</label>
              <div className="flex gap-1.5">
                {[{ label: 'All Buyers', value: false }, { label: 'GST Verified Only', value: true }].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => updateFilter('buyerVerified', opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filters.buyerVerified === opt.value ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:border-primary/40'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Viewed Status */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Reveal Status</label>
              <div className="flex gap-1.5">
                {[{ label: 'All', value: 'all' }, { label: 'Unviewed', value: 'unviewed' }, { label: 'Viewed', value: 'viewed' }].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter('revealStatus', opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filters.revealStatus === opt.value ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:border-primary/40'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* New Leads Only */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                New Leads Only
                {newSinceLastLogin > 0 && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-medium">
                    {newSinceLastLogin} new since last visit
                  </span>
                )}
              </label>
              <button
                role="switch"
                aria-checked={filters.newOnly}
                onClick={() => updateFilter('newOnly', !filters.newOnly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${filters.newOnly ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${filters.newOnly ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* State/Region (domestic only) */}
          {isDomestic && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">State / Region</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {INDIAN_STATES.map((state) => (
                  <button
                    key={state}
                    onClick={() => toggleArrayFilter('deliveryState', state)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${filters.deliveryState.includes(state) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:border-primary/40'}`}
                  >
                    {state}
                  </button>
                ))}
              </div>
              {filters.deliveryState.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {filters.deliveryState.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {s}
                      <button onClick={() => toggleArrayFilter('deliveryState', s)} className="hover:text-primary/60"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Result count */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {isLoading ? 'Searching…' : total > 0 ? `Showing ${total} lead${total !== 1 ? 's' : ''}` : 'No leads match your filters'}
        </p>
        {newSinceLastLogin > 0 && activeTab === 'active' && !filters.newOnly && (
          <button
            onClick={() => updateFilter('newOnly', true)}
            className="text-xs text-primary hover:underline font-medium"
          >
            {newSinceLastLogin} new since last visit →
          </button>
        )}
      </div>
    </div>
  );

  // ── Reveal modal ────────────────────────────────────────────────────────────

  const revealModal = revealingLead ? (
    <RevealModal
      lead={revealingLead}
      revealedContact={revealedContact}
      walletBalance={walletBalance}
      isRevealing={isRevealing}
      onConfirm={handleConfirmReveal}
      onClose={() => { setRevealingLead(null); setRevealedContact(null); }}
      onViewRevealedLeads={() => { setRevealingLead(null); setRevealedContact(null); setActiveTab('revealed'); }}
      accessToken={accessToken ?? undefined}
      onWalletLoaded={setWalletBalance}
    />
  ) : null;

  // ── Tabs ────────────────────────────────────────────────────────────────────

  const tabs: { key: ActiveTab; label: string; badge?: number }[] = [
    { key: 'active', label: 'All Leads' },
    { key: 'matched', label: 'Matched for You', badge: matchedTotal > 0 ? matchedTotal : undefined },
    { key: 'saved', label: 'Saved' },
    { key: 'revealed', label: 'Revealed' },
  ];

  // ── Main content ────────────────────────────────────────────────────────────

  const mainContent = (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buy Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Spend 1 credit to reveal buyer contact details.
          </p>
        </div>
        <CreditWidget accessToken={accessToken ?? undefined} refreshKey={walletRefreshKey} />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-primary text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {tab.key === 'matched' && <Sparkles className="h-3.5 w-3.5" />}
            {tab.label}
            {tab.badge != null && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── All Leads ── */}
      {activeTab === 'active' && (
        <>
          {filterBar}
          {renderLeadGrid(leads, isLoading, 'No active buy leads')}
          {page < totalPages && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => fetchLeads(page + 1)}
                disabled={isLoading}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Loading…' : `Load More (${total - leads.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Matched ── */}
      {activeTab === 'matched' && (
        <>
          {!hasCategories && !isMatchedLoading && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No approved products with categories yet. Add products to get category-matched leads.
            </div>
          )}
          {matchedTotal > 0 && <p className="mb-4 text-sm text-gray-500">{matchedTotal} lead{matchedTotal !== 1 ? 's' : ''} matching your product categories</p>}
          {renderLeadGrid(matchedLeads, isMatchedLoading, 'No matched leads right now')}
          {matchedPage < matchedTotalPages && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => fetchMatchedLeads(matchedPage + 1)}
                disabled={isMatchedLoading}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isMatchedLoading ? 'Loading…' : `Load More (${matchedTotal - matchedLeads.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Saved ── */}
      {activeTab === 'saved' && (
        <SavedLeads
          accessToken={accessToken ?? undefined}
          revealedLeadIds={revealedLeadIds}
          onReveal={handleRevealRequest}
          onToggleSave={handleToggleSave}
          savedLeadIds={savedLeadIds}
        />
      )}

      {/* ── Revealed ── */}
      {activeTab === 'revealed' && (
        <MyRevealedLeads accessToken={accessToken ?? undefined} />
      )}
    </>
  );

  if (hideShell) {
    return <div className="px-6 py-6">{mainContent}{revealModal}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8">
        {mainContent}
      </main>
      <Footer />
      {revealModal}
    </div>
  );
}
