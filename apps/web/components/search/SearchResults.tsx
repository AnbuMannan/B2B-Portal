'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { BadgeCheck, Globe, TrendingUp } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SearchProduct {
  id: string;
  name: string;
  description?: string;
  primaryImage?: string;
  sellerCompanyName: string;
  sellerState?: string;
  companyType?: string;
  isVerified: boolean;
  hasIEC: boolean;
  priceRetail?: number;
  priceWholesale?: number;
  priceBulk?: number;
  moqRetail?: number;
  verificationBadges: string[];
  categoryNames: string[];
  createdAt: string;
  highlight?: { name?: string[]; description?: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Renders a name with matched terms wrapped in <mark> tags (injected by ES highlight).
 * The text comes from Elasticsearch highlight which already wraps matches in <mark>…</mark>.
 * We strip HTML outside <mark> to prevent XSS.
 */
function HighlightedText({ html, fallback }: { html?: string; fallback: string }) {
  if (!html) return <span>{fallback}</span>;
  // Only allow <mark> tags — everything else is text
  const sanitised = html.replace(/<(?!\/?mark>)[^>]+>/g, '');
  return <span dangerouslySetInnerHTML={{ __html: sanitised }} />;
}

function PriceTier({
  label,
  price,
  moq,
}: {
  label: string;
  price: number;
  moq?: number;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-foreground">
          ₹{price.toLocaleString('en-IN')}
        </span>
        {moq && <span className="ml-1 text-muted-foreground">MOQ {moq}</span>}
      </div>
    </div>
  );
}

// ─── CTR tracking (best-effort, fire-and-forget) ─────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

function trackClick(query: string, productId: string, position: number) {
  if (!query.trim()) return;
  fetch(`${API_URL}/api/search/track-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, productId, position }),
  }).catch(() => undefined); // silent — never blocks navigation
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function SearchProductCard({
  product,
  position,
  query,
  isSponsored = false,
}: {
  product: SearchProduct;
  position: number;
  query: string;
  isSponsored?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const highlightedName = product.highlight?.name?.[0];

  const pricingRows: Array<{ label: string; price: number; moq?: number }> = [];
  if (product.priceRetail) pricingRows.push({ label: 'Retail', price: product.priceRetail, moq: product.moqRetail });
  if (product.priceWholesale) pricingRows.push({ label: 'Wholesale', price: product.priceWholesale });
  if (product.priceBulk) pricingRows.push({ label: 'Bulk', price: product.priceBulk });

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Sponsored badge placeholder */}
      {isSponsored && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          Sponsored
        </span>
      )}

      <Link href={`/product/${product.id}`} className="block" onClick={() => trackClick(query, product.id, position)}>
        {/* Image */}
        <div className="relative h-44 overflow-hidden bg-muted">
          {!imgError && product.primaryImage ? (
            <Image
              src={product.primaryImage}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/60">
              <span className="text-4xl">📦</span>
            </div>
          )}

          {/* Verification badges over image */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {product.isVerified && (
              <span className="flex items-center gap-0.5 rounded-full bg-green-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                <BadgeCheck className="h-3 w-3" />
                Verified
              </span>
            )}
            {product.hasIEC && (
              <span className="flex items-center gap-0.5 rounded-full bg-blue-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                <Globe className="h-3 w-3" />
                IEC
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2 p-3">
          {/* Product name — highlighted */}
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary [&_mark]:bg-yellow-200 [&_mark]:text-foreground [&_mark]:not-italic">
            <HighlightedText html={highlightedName} fallback={product.name} />
          </h3>

          {/* Seller */}
          <div className="flex items-center justify-between">
            <p className="truncate text-xs text-muted-foreground">{product.sellerCompanyName}</p>
            {product.sellerState && (
              <span className="shrink-0 text-xs text-muted-foreground">{product.sellerState}</span>
            )}
          </div>

          {/* Pricing tiers */}
          {pricingRows.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2">
              {pricingRows.slice(0, 2).map((row) => (
                <PriceTier key={row.label} {...row} />
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Hover overlay CTAs */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
        <Link
          href={`/product/${product.id}`}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow hover:bg-gray-50"
        >
          View Details
        </Link>
        <Link
          href={`/product/${product.id}?action=quote`}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
        >
          Get Quote
        </Link>
      </div>
    </div>
  );
}

// ─── Sort Bar ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'RELEVANCE', label: 'Relevance' },
  { value: 'PRICE_ASC', label: 'Price: Low → High' },
  { value: 'PRICE_DESC', label: 'Price: High → Low' },
  { value: 'NEWEST', label: 'Newest' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

function SortBar({
  current,
  onChange,
}: {
  current: string;
  onChange: (v: SortValue) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">Sort:</span>
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            current === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-foreground hover:bg-muted'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= totalPages - 3) return totalPages - 6 + i;
    return page - 3 + i;
  });

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted"
      >
        ← Prev
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1.5 text-sm ${
            p === page
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'border border-border hover:bg-muted'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted"
      >
        Next →
      </button>
    </div>
  );
}

// ─── Zero Results ─────────────────────────────────────────────────────────────

const SIMILAR_TERMS: Record<string, string[]> = {
  dal: ['pulses', 'lentils', 'chana dal'],
  kapda: ['fabric', 'textile', 'cloth'],
  dawa: ['medicine', 'pharmaceutical', 'drugs'],
  machine: ['machinery', 'equipment', 'tools'],
  kaagaz: ['paper', 'stationery', 'packaging'],
};

function ZeroResults({
  query,
  trendingProducts,
}: {
  query: string;
  trendingProducts: SearchProduct[];
}) {
  const q = query.toLowerCase().trim();
  const similarTerms = SIMILAR_TERMS[q] ?? [];

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mb-3 text-5xl">🔍</div>
        <h3 className="mb-1 text-lg font-semibold text-foreground">
          No results for &quot;{query}&quot;
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Try checking your spelling or using more general terms.
        </p>
        {similarTerms.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Try:</span>
            {similarTerms.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/20"
              >
                {term}
              </Link>
            ))}
          </div>
        )}
      </div>

      {trendingProducts.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-foreground">Trending Products</h4>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trendingProducts.slice(0, 6).map((product) => (
              <SearchProductCard key={product.id} product={product} position={-1} query="" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-border bg-card">
          <div className="h-44 bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-4 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface SearchResultsProps {
  products: SearchProduct[];
  trendingProducts: SearchProduct[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  searchTerm: string;
  sortBy: string;
  onSortChange: (v: SortValue) => void;
  onPageChange: (p: number) => void;
}

export function SearchResults({
  products,
  trendingProducts,
  total,
  page,
  totalPages,
  isLoading,
  searchTerm,
  sortBy,
  onSortChange,
  onPageChange,
}: SearchResultsProps) {
  if (isLoading) return <LoadingSkeleton />;

  if (total === 0) {
    return <ZeroResults query={searchTerm} trendingProducts={trendingProducts} />;
  }

  const pageOffset = (page - 1) * 20; // global position offset for pagination

  return (
    <div className="space-y-4">
      <SortBar current={sortBy} onChange={onSortChange} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product, i) => (
          <SearchProductCard
            key={product.id}
            product={product}
            position={pageOffset + i}
            query={searchTerm}
            isSponsored={i === 0} // First slot = future ad placement
          />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
    </div>
  );
}

export default SearchResults;
