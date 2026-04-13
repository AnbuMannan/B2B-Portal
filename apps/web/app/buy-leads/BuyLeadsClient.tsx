'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/homepage/Header';
import Footer from '../../components/homepage/Footer';
import { LeadCard } from './components/LeadCard';
import { RevealModal } from './components/RevealModal';
import { CreditWidget } from './components/CreditWidget';
import { MyRevealedLeads } from './components/MyRevealedLeads';
import { SavedLeads } from './components/SavedLeads';
import { Search, ChevronDown, Sparkles } from 'lucide-react';
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
  revealed?: boolean;
  isMatched?: boolean;
  categoryId?: string | null;
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
}

const COUNTRY_OPTIONS = [
  'All Countries', 'India', 'UAE', 'USA', 'UK', 'Saudi Arabia',
  'Singapore', 'Australia', 'Canada', 'Germany', 'China',
];

const DATE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'last3days', label: 'Last 3 Days' },
  { value: 'lastweek', label: 'Last Week' },
];

type ActiveTab = 'active' | 'matched' | 'saved' | 'revealed';

function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded?.role ?? null;
  } catch {
    return null;
  }
}

export function BuyLeadsClient({ hideShell = false }: { hideShell?: boolean }) {
  const router = useRouter();

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

  // Filters (active tab only)
  const [searchTerm, setSearchTerm] = useState('');
  const [country, setCountry] = useState('');
  const [postedAfter, setPostedAfter] = useState<string>('all');

  // Reveal modal
  const [revealingLead, setRevealingLead] = useState<BuyLead | null>(null);
  const [revealedContact, setRevealedContact] = useState<RevealedContact | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  // Wallet
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/auth/signin?returnUrl=/buy-leads');
      return;
    }
    const role = decodeJwtRole(token);
    if (role !== 'SELLER') {
      toast.error('Buy leads are for registered sellers only.');
      router.replace('/');
      return;
    }
    setAccessToken(token);
    setAuthLoading(false);
  }, [router]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async (pageNum = 1, reset = false) => {
    if (!accessToken) return;
    setIsLoading(true);

    const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
    if (searchTerm) params.set('productName', searchTerm);
    if (country && country !== 'All Countries') params.set('country', country);
    if (postedAfter !== 'all') params.set('postedAfter', postedAfter);

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, searchTerm, country, postedAfter]);

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
        const ids = new Set<string>(
          (json.data.reveals as RevealedContact[]).map((r) => r.buyLeadId)
        );
        setRevealedLeadIds(ids);
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
      if (res.ok && json.data?.ids) {
        setSavedLeadIds(new Set<string>(json.data.ids));
      }
    } catch { /* non-critical */ }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      fetchLeads(1, true);
      fetchRevealedIds();
      fetchSavedIds();
    }
  }, [accessToken, fetchLeads, fetchRevealedIds, fetchSavedIds]);

  // Lazy-load matched leads when tab is first selected
  useEffect(() => {
    if (activeTab === 'matched' && accessToken && matchedLeads.length === 0) {
      fetchMatchedLeads(1, true);
    }
  }, [activeTab, accessToken, matchedLeads.length, fetchMatchedLeads]);

  const handleSearch = () => {
    setLeads([]);
    fetchLeads(1, true);
  };

  // ── Save toggle ───────────────────────────────────────────────────────────

  const handleToggleSave = useCallback(async (lead: BuyLead) => {
    if (!accessToken) return;
    const wasSaved = savedLeadIds.has(lead.id);

    // Optimistic update
    setSavedLeadIds((prev) => {
      const next = new Set(Array.from(prev));
      if (wasSaved) next.delete(lead.id); else next.add(lead.id);
      return next;
    });

    try {
      const res = await fetch(`${API_BASE}/api/seller/leads/${lead.id}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to save lead');
      toast.success(json.data?.saved ? 'Lead saved to watchlist' : 'Lead removed from watchlist');
    } catch (err) {
      // Revert on error
      setSavedLeadIds((prev) => {
        const next = new Set(Array.from(prev));
        if (wasSaved) next.add(lead.id); else next.delete(lead.id);
        return next;
      });
      toast.error(err instanceof Error ? err.message : 'Failed to update watchlist');
    }
  }, [accessToken, savedLeadIds]);

  // ── Reveal contact ────────────────────────────────────────────────────────

  const handleRevealRequest = async (lead: BuyLead) => {
    setRevealingLead(lead);
    setRevealedContact(null);

    if (revealedLeadIds.has(lead.id) && accessToken) {
      setIsRevealing(true);
      try {
        const res = await fetch(`${API_BASE}/api/buy-leads/${lead.id}/reveal`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (res.ok) setRevealedContact(json.data as RevealedContact);
        else toast.error(json.message ?? 'Failed to load contact');
      } catch {
        toast.error('Failed to load contact details');
      } finally {
        setIsRevealing(false);
      }
    }
  };

  const handleConfirmReveal = async () => {
    if (!revealingLead || !accessToken) return;
    setIsRevealing(true);

    try {
      const res = await fetch(`${API_BASE}/api/buy-leads/${revealingLead.id}/reveal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();

      if (!res.ok) {
        const code = json.error?.code ?? json.data?.code;
        if (code === 'INSUFFICIENT_CREDITS') {
          toast.error('Insufficient credits. Please recharge your wallet.');
          setRevealingLead(null);
          return;
        }
        throw new Error(json.message ?? 'Failed to reveal contact');
      }

      setRevealedContact(json.data as RevealedContact);
      setRevealedLeadIds((prev) => {
        const s = new Set(Array.from(prev));
        s.add(revealingLead.id);
        return s;
      });
      setWalletRefreshKey((k) => k + 1);

      if (!json.data.alreadyRevealed) {
        toast.success('Contact revealed! 1 credit deducted.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reveal contact');
    } finally {
      setIsRevealing(false);
    }
  };

  // ── Loading guard ─────────────────────────────────────────────────────────

  if (authLoading) {
    const spinner = (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
    if (hideShell) return spinner;
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">{spinner}</main>
        <Footer />
      </div>
    );
  }

  // ── Reveal modal ──────────────────────────────────────────────────────────

  const revealModal = revealingLead ? (
    <RevealModal
      lead={revealingLead}
      revealedContact={revealedContact}
      walletBalance={walletBalance}
      isRevealing={isRevealing}
      onConfirm={handleConfirmReveal}
      onClose={() => { setRevealingLead(null); setRevealedContact(null); }}
      onViewRevealedLeads={() => {
        setRevealingLead(null);
        setRevealedContact(null);
        setActiveTab('revealed');
      }}
      accessToken={accessToken ?? undefined}
      onWalletLoaded={setWalletBalance}
    />
  ) : null;

  // ── Tab definitions ───────────────────────────────────────────────────────

  const tabs: { key: ActiveTab; label: string; badge?: number }[] = [
    { key: 'active', label: 'All Leads' },
    { key: 'matched', label: 'Matched for You', badge: matchedTotal > 0 ? matchedTotal : undefined },
    { key: 'saved', label: 'Saved' },
    { key: 'revealed', label: 'Revealed' },
  ];

  // ── Lead grid helper ──────────────────────────────────────────────────────

  const renderLeadGrid = (items: BuyLead[], loading: boolean, emptyMsg: string) => {
    if (loading && items.length === 0) {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      );
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

  // ── Main content ──────────────────────────────────────────────────────────

  const mainContent = (
    <>
      {/* Header */}
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
            className={`relative flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.key === 'matched' && <Sparkles className="h-3.5 w-3.5" />}
            {tab.label}
            {tab.badge != null && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── All Leads ── */}
      {activeTab === 'active' && (
        <>
          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search product name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="relative">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c === 'All Countries' ? '' : c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative">
              <select
                value={postedAfter}
                onChange={(e) => setPostedAfter(e.target.value)}
                className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {DATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <button
              onClick={handleSearch}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </div>

          {!isLoading && (
            <p className="mb-4 text-sm text-gray-500">
              {total > 0 ? `${total} active buy leads` : 'No leads match your filters'}
            </p>
          )}

          {renderLeadGrid(leads, isLoading, 'No active buy leads')}

          {page < totalPages && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => fetchLeads(page + 1)}
                disabled={isLoading}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Loading...' : `Load More (${total - leads.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Matched for You ── */}
      {activeTab === 'matched' && (
        <>
          {!hasCategories && !isMatchedLoading && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No approved products with categories yet. Add products to get category-matched leads.
            </div>
          )}
          {matchedTotal > 0 && (
            <p className="mb-4 text-sm text-gray-500">
              {matchedTotal} lead{matchedTotal !== 1 ? 's' : ''} matching your product categories
            </p>
          )}
          {renderLeadGrid(matchedLeads, isMatchedLoading, 'No matched leads right now')}
          {matchedPage < matchedTotalPages && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => fetchMatchedLeads(matchedPage + 1)}
                disabled={isMatchedLoading}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isMatchedLoading ? 'Loading...' : `Load More (${matchedTotal - matchedLeads.length} remaining)`}
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
    return (
      <div className="px-6 py-6">
        {mainContent}
        {revealModal}
      </div>
    );
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
