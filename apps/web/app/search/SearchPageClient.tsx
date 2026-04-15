'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../components/homepage/Header';
import Footer from '../../components/homepage/Footer';
import { SearchFilters, type FilterState, type SearchAggregations } from '../../components/search/SearchFilters';
import { SearchResults, type SearchProduct } from '../../components/search/SearchResults';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface SearchResponse {
  products: SearchProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  aggregations: SearchAggregations;
  trendingProducts: SearchProduct[];
}

const EMPTY_AGGS: SearchAggregations = {
  states: [],
  companyTypes: [],
  priceRanges: [],
  categories: [],
};

const EMPTY_RESPONSE: SearchResponse = {
  products: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  aggregations: EMPTY_AGGS,
  trendingProducts: [],
};

// ─── URL ↔ State helpers ──────────────────────────────────────────────────────

function paramsToFilters(sp: URLSearchParams): FilterState {
  return {
    priceMin: sp.get('priceMin') ? Number(sp.get('priceMin')) : undefined,
    priceMax: sp.get('priceMax') ? Number(sp.get('priceMax')) : undefined,
    states: sp.getAll('state'),
    sellerTypes: sp.getAll('sellerType'),
    verifiedOnly: sp.get('verified') === 'true',
    iecGlobal: sp.get('iec') === 'true',
  };
}

function filtersToParams(filters: FilterState, q: string, page: number, sortBy: string): URLSearchParams {
  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  if (page > 1) sp.set('page', String(page));
  if (sortBy !== 'RELEVANCE') sp.set('sortBy', sortBy);
  if (filters.priceMin !== undefined) sp.set('priceMin', String(filters.priceMin));
  if (filters.priceMax !== undefined) sp.set('priceMax', String(filters.priceMax));
  filters.states.forEach((s) => sp.append('state', s));
  filters.sellerTypes.forEach((t) => sp.append('sellerType', t));
  if (filters.verifiedOnly) sp.set('verified', 'true');
  if (filters.iecGlobal) sp.set('iec', 'true');
  return sp;
}

// ─── Page Component ───────────────────────────────────────────────────────────

export function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial state from URL
  const initialPage = Number(searchParams.get('page') ?? '1');
  const initialSort = searchParams.get('sortBy') ?? 'RELEVANCE';
  const initialFilters = paramsToFilters(searchParams);

  // Keep track of current q from URL (may differ after navigate)
  const currentQuery = searchParams.get('q') ?? '';

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [sortBy, setSortBy] = useState(initialSort);
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState<SearchResponse>(EMPTY_RESPONSE);
  const [isLoading, setIsLoading] = useState(!!currentQuery);

  // Abort controller ref to cancel in-flight requests
  const abortRef = useRef<AbortController | undefined>(undefined);

  const runSearch = useCallback(
    async (q: string, f: FilterState, p: number, sort: string) => {
      if (!q.trim()) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      try {
        const body = {
          q,
          page: p,
          limit: 20,
          filters: {
            priceMin: f.priceMin,
            priceMax: f.priceMax,
            states: f.states.length ? f.states : undefined,
            sellerTypes: f.sellerTypes.length ? f.sellerTypes : undefined,
            verifiedOnly: f.verifiedOnly || undefined,
            iecGlobal: f.iecGlobal || undefined,
            sortBy: sort !== 'RELEVANCE' ? sort : undefined,
          },
        };

        const res = await fetch(`${API_BASE}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error(`Search API error: ${res.status}`);
        const json: SearchResponse = await res.json();
        setData(json);
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Search failed:', err);
          setData(EMPTY_RESPONSE);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Run search whenever URL query changes (covers browser back/forward)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const p = Number(searchParams.get('page') ?? '1');
    const sort = searchParams.get('sortBy') ?? 'RELEVANCE';
    const f = paramsToFilters(searchParams);

    setFilters(f);
    setSortBy(sort);
    setPage(p);

    // Set loading immediately so the skeleton shows before runSearch's async fetch begins.
    // This prevents a flash of "No results" between URL change and first fetch response.
    if (q) setIsLoading(true);
    if (q) runSearch(q, f, p, sort);
  }, [searchParams, runSearch]);

  // Push filter/sort/page changes to URL (triggers the effect above)
  const onFilterChange = (next: FilterState) => {
    setFilters(next);
    const params = filtersToParams(next, currentQuery, 1, sortBy);
    router.push(`/search?${params.toString()}`);
  };

  const onSortChange = (sort: string) => {
    setSortBy(sort);
    const params = filtersToParams(filters, currentQuery, 1, sort);
    router.push(`/search?${params.toString()}`);
  };

  const onPageChange = (p: number) => {
    setPage(p);
    const params = filtersToParams(filters, currentQuery, p, sortBy);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6">
        {/* SearchFilters renders a Fragment:
            - <div className="lg:hidden"> → mobile toggle button (visible on small screens)
            - <aside className="hidden lg:block"> → desktop sidebar
            Both become siblings in the flex-col/flex-row container, giving correct layout. */}
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <SearchFilters
            aggregations={data.aggregations}
            filters={filters}
            onFilterChange={onFilterChange}
            totalResults={data.total}
            query={currentQuery}
          />

          {/* Results */}
          <div className="min-w-0 flex-1">
            <SearchResults
              products={data.products}
              trendingProducts={data.trendingProducts}
              total={data.total}
              page={page}
              totalPages={data.totalPages}
              isLoading={isLoading}
              searchTerm={currentQuery}
              sortBy={sortBy}
              onSortChange={onSortChange}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
