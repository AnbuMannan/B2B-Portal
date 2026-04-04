'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '../../components/homepage/Header';
import Footer from '../../components/homepage/Footer';
import { LeadCard } from './components/LeadCard';
import { RevealModal } from './components/RevealModal';
import { CreditWidget } from './components/CreditWidget';
import { MyRevealedLeads } from './components/MyRevealedLeads';
import { Search, ChevronDown } from 'lucide-react';
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
  lead?: BuyLead;
}

interface LeadsResponse {
  leads: BuyLead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

type ActiveTab = 'active' | 'revealed';

export function BuyLeadsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [leads, setLeads] = useState<BuyLead[]>([]);
  const [revealedLeadIds, setRevealedLeadIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
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

  const isSeller = session?.user?.role === 'SELLER';

  // ── Auth check ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn(undefined, {
        callbackUrl: '/buy-leads',
        redirect: true,
      });
    } else if (status === 'authenticated' && !isSeller) {
      toast.error('Buy leads are for registered sellers only.');
      router.replace('/');
    }
  }, [status, isSeller, router]);

  // ── Fetch leads ───────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async (pageNum = 1, reset = false) => {
    if (!session?.accessToken) return;
    setIsLoading(true);

    const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
    if (searchTerm) params.set('productName', searchTerm);
    if (country && country !== 'All Countries') params.set('country', country);
    if (postedAfter !== 'all') params.set('postedAfter', postedAfter);

    try {
      const res = await fetch(`${API_BASE}/api/buy-leads?${params}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
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
  }, [session?.accessToken, searchTerm, country, postedAfter]);

  // Fetch my revealed lead IDs (to show "Revealed ✓" badge on cards)
  const fetchRevealedIds = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/buy-leads/my-revealed?limit=50`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const json = await res.json();
      if (res.ok && json.data?.reveals) {
        const ids = new Set<string>(Array.from(
          (json.data.reveals as RevealedContact[]).map((r) => r.buyLeadId),
        ));
        setRevealedLeadIds(ids);
      }
    } catch {
      // Non-critical
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'authenticated' && isSeller) {
      fetchLeads(1, true);
      fetchRevealedIds();
    }
  }, [status, isSeller, fetchLeads, fetchRevealedIds]);

  // Re-fetch when filters change (reset to page 1)
  const handleSearch = () => {
    setLeads([]);
    fetchLeads(1, true);
  };

  // ── Reveal contact ────────────────────────────────────────────────────────

  const handleRevealRequest = async (lead: BuyLead) => {
    setRevealingLead(lead);
    setRevealedContact(null);

    // Already revealed: skip confirmation, fetch contact immediately (API is idempotent)
    if (revealedLeadIds.has(lead.id) && session?.accessToken) {
      setIsRevealing(true);
      try {
        const res = await fetch(`${API_BASE}/api/buy-leads/${lead.id}/reveal`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.accessToken}` },
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
    if (!revealingLead || !session?.accessToken) return;
    setIsRevealing(true);

    try {
      const res = await fetch(`${API_BASE}/api/buy-leads/${revealingLead.id}/reveal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
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
      setRevealedLeadIds((prev) => { const s = new Set(Array.from(prev)); s.add(revealingLead.id); return s; });
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

  // ── Loading / auth guard ──────────────────────────────────────────────────

  if (status === 'loading' || (status === 'authenticated' && !isSeller)) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Active Buy Leads</h1>
            <p className="mt-1 text-sm text-gray-500">
              Showing real-time buyer requirements. Spend 1 credit to reveal contact details.
            </p>
          </div>
          <CreditWidget
            accessToken={session?.accessToken}
            refreshKey={walletRefreshKey}
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 w-fit">
          {(['active', 'revealed'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'active' ? 'Active Leads' : 'My Revealed Leads'}
            </button>
          ))}
        </div>

        {/* Active Leads Tab */}
        {activeTab === 'active' && (
          <>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              {/* Search */}
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

              {/* Country */}
              <div className="relative">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c === 'All Countries' ? '' : c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>

              {/* Date posted */}
              <div className="relative">
                <select
                  value={postedAfter}
                  onChange={(e) => setPostedAfter(e.target.value)}
                  className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {DATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
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

            {/* Results count */}
            {!isLoading && (
              <p className="mb-4 text-sm text-gray-500">
                {total > 0 ? `${total} active buy leads` : 'No leads match your filters'}
              </p>
            )}

            {/* Lead cards grid */}
            {isLoading && leads.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
                <p className="text-lg font-semibold text-gray-700">No active buy leads</p>
                <p className="mt-1 text-sm text-gray-400">
                  Check back later or adjust your filters.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isRevealed={revealedLeadIds.has(lead.id)}
                    onReveal={() => handleRevealRequest(lead)}
                    accessToken={session?.accessToken}
                  />
                ))}
              </div>
            )}

            {/* Load More */}
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

        {/* My Revealed Leads Tab */}
        {activeTab === 'revealed' && (
          <MyRevealedLeads accessToken={session?.accessToken} />
        )}
      </main>

      <Footer />

      {/* Reveal Modal */}
      {revealingLead && (
        <RevealModal
          lead={revealingLead}
          revealedContact={revealedContact}
          walletBalance={walletBalance}
          isRevealing={isRevealing}
          onConfirm={handleConfirmReveal}
          onClose={() => {
            setRevealingLead(null);
            setRevealedContact(null);
          }}
          onViewRevealedLeads={() => {
            setRevealingLead(null);
            setRevealedContact(null);
            setActiveTab('revealed');
          }}
          accessToken={session?.accessToken}
          onWalletLoaded={setWalletBalance}
        />
      )}
    </div>
  );
}
