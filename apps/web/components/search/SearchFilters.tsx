'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from 'lucide-react';

export interface FilterState {
  priceMin?: number;
  priceMax?: number;
  states: string[];
  sellerTypes: string[];
  verifiedOnly: boolean;
  iecGlobal: boolean;
}

export interface AggBucket {
  key: string;
  docCount: number;
}

export interface SearchAggregations {
  states: AggBucket[];
  companyTypes: AggBucket[];
  priceRanges: Array<{ key: string; from?: number; to?: number; docCount: number }>;
  categories: AggBucket[];
}

interface SearchFiltersProps {
  aggregations: SearchAggregations;
  filters: FilterState;
  onFilterChange: (next: FilterState) => void;
  totalResults: number;
  query: string;
}

const SELLER_TYPES = ['PROPRIETORSHIP', 'PRIVATE_LIMITED', 'LLP'];
const SELLER_TYPE_LABELS: Record<string, string> = {
  PROPRIETORSHIP: 'Proprietorship',
  PRIVATE_LIMITED: 'Private Limited',
  LLP: 'LLP',
};

const PRICE_PRESETS = [
  { label: 'Under ₹1,000', min: undefined, max: 1000 },
  { label: '₹1,000 – ₹5,000', min: 1000, max: 5000 },
  { label: '₹5,000 – ₹25,000', min: 5000, max: 25000 },
  { label: '₹25,000+', min: 25000, max: undefined },
];

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border pb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-2 text-sm font-semibold text-foreground"
      >
        {title}
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="mt-2 space-y-1.5">{children}</div>}
    </div>
  );
}

export function SearchFilters({
  aggregations,
  filters,
  onFilterChange,
  totalResults,
  query,
}: SearchFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const hasActiveFilters =
    filters.states.length > 0 ||
    filters.sellerTypes.length > 0 ||
    filters.verifiedOnly ||
    filters.iecGlobal ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined;

  const clearAll = () =>
    onFilterChange({
      states: [],
      sellerTypes: [],
      verifiedOnly: false,
      iecGlobal: false,
      priceMin: undefined,
      priceMax: undefined,
    });

  const toggleState = (state: string) => {
    const next = filters.states.includes(state)
      ? filters.states.filter((s) => s !== state)
      : [...filters.states, state];
    onFilterChange({ ...filters, states: next });
  };

  const toggleSellerType = (type: string) => {
    const next = filters.sellerTypes.includes(type)
      ? filters.sellerTypes.filter((t) => t !== type)
      : [...filters.sellerTypes, type];
    onFilterChange({ ...filters, sellerTypes: next });
  };

  const setPricePreset = (min?: number, max?: number) => {
    onFilterChange({ ...filters, priceMin: min, priceMax: max });
  };

  const panel = (
    <div className="space-y-4">
      {/* Results count & clear */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalResults.toLocaleString('en-IN')}</span>{' '}
          results for{' '}
          <span className="font-semibold text-foreground">&quot;{query}&quot;</span>
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-destructive hover:underline"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Price Range */}
      <Section title="Price Range">
        <div className="space-y-1.5">
          {PRICE_PRESETS.map((preset) => {
            const isActive =
              filters.priceMin === preset.min && filters.priceMax === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  isActive
                    ? setPricePreset(undefined, undefined)
                    : setPricePreset(preset.min, preset.max)
                }
                className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {preset.label}
                {aggregations.priceRanges.find((r) => r.key === `${preset.min ?? 0}-${preset.max}`)
                  ?.docCount !== undefined && (
                  <span className="float-right text-xs text-muted-foreground">
                    {
                      aggregations.priceRanges.find(
                        (r) =>
                          (r.from ?? 0) === (preset.min ?? 0) &&
                          (r.to ?? Infinity) === (preset.max ?? Infinity),
                      )?.docCount
                    }
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Custom range inputs */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min ₹"
            value={filters.priceMin ?? ''}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                priceMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            min={0}
            placeholder="Max ₹"
            value={filters.priceMax ?? ''}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                priceMax: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </Section>

      {/* States */}
      {aggregations.states.length > 0 && (
        <Section title="State / Region">
          {aggregations.states.map((bucket) => (
            <label key={bucket.key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={filters.states.includes(bucket.key)}
                onChange={() => toggleState(bucket.key)}
                className="h-4 w-4 accent-primary"
              />
              <span className="flex-1 text-sm text-foreground">{bucket.key}</span>
              <span className="text-xs text-muted-foreground">{bucket.docCount}</span>
            </label>
          ))}
        </Section>
      )}

      {/* Seller Type */}
      <Section title="Seller Type">
        {(aggregations.companyTypes.length > 0
          ? aggregations.companyTypes
          : SELLER_TYPES.map((t) => ({ key: t, docCount: 0 }))
        ).map((bucket) => (
          <label key={bucket.key} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filters.sellerTypes.includes(bucket.key)}
              onChange={() => toggleSellerType(bucket.key)}
              className="h-4 w-4 accent-primary"
            />
            <span className="flex-1 text-sm text-foreground">
              {SELLER_TYPE_LABELS[bucket.key] ?? bucket.key}
            </span>
            {bucket.docCount > 0 && (
              <span className="text-xs text-muted-foreground">{bucket.docCount}</span>
            )}
          </label>
        ))}
      </Section>

      {/* Verification */}
      <Section title="Verification">
        <label className="flex cursor-pointer items-center justify-between gap-2">
          <span className="text-sm text-foreground">Verified Sellers Only</span>
          <button
            type="button"
            role="switch"
            aria-checked={filters.verifiedOnly}
            onClick={() => onFilterChange({ ...filters, verifiedOnly: !filters.verifiedOnly })}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              filters.verifiedOnly ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                filters.verifiedOnly ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-2">
          <span className="text-sm text-foreground">IEC Global (Export Ready)</span>
          <button
            type="button"
            role="switch"
            aria-checked={filters.iecGlobal}
            onClick={() => onFilterChange({ ...filters, iecGlobal: !filters.iecGlobal })}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              filters.iecGlobal ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                filters.iecGlobal ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </Section>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {filters.states.length +
                filters.sellerTypes.length +
                (filters.verifiedOnly ? 1 : 0) +
                (filters.iecGlobal ? 1 : 0)}
            </span>
          )}
        </button>
        {mobileOpen && (
          <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
            {panel}
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20 rounded-lg border border-border bg-card p-4 shadow-sm">
          {panel}
        </div>
      </aside>
    </>
  );
}

export default SearchFilters;
