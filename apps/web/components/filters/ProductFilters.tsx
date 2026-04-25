'use client';

import { useState, useCallback } from 'react';

interface FilterState {
  priceMin?: number;
  priceMax?: number;
  state?: string;
  sellerTypes?: string[];
  verificationBadges?: string[];
  verifiedOnly?: boolean;
  iecGlobal?: boolean;
}

interface ProductFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  isLoading?: boolean;
}

const PRICE_MAX = 10000000;

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

// Values sent to API must match Prisma BusinessModel enum (uppercased in service)
const SELLER_TYPES = [
  { value: 'MANUFACTURER', label: 'Manufacturer' },
  { value: 'WHOLESALER',   label: 'Wholesaler' },
  { value: 'DISTRIBUTOR',  label: 'Distributor' },
  { value: 'RETAILER',     label: 'Retailer' },
];

const VERIFICATION_BADGES = [
  { value: 'GST Verified', label: 'GST Verified' },
  { value: 'IEC Global',   label: 'IEC Global' },
  { value: 'MSME',         label: 'MSME Registered' },
];

const PRICE_PRESETS = [
  { label: '₹0–10K',   min: 0,      max: 10000 },
  { label: '₹10K–1L',  min: 10000,  max: 100000 },
  { label: '₹1L+',     min: 100000, max: PRICE_MAX },
];

function formatPrice(v: number) {
  if (v >= 10000000) return '₹1 Cr';
  if (v >= 100000)   return `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return `₹${v}`;
}

const ProductFilters = ({ filters, onFiltersChange, isLoading = false }: ProductFiltersProps) => {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const update = useCallback(
    (patch: Partial<FilterState>) => onFiltersChange({ ...filters, ...patch }),
    [filters, onFiltersChange],
  );

  const toggleSellerType = (val: string, checked: boolean) => {
    const cur = filters.sellerTypes ?? [];
    const next = checked ? [...cur, val] : cur.filter(v => v !== val);
    update({ sellerTypes: next.length ? next : undefined });
  };

  const toggleBadge = (val: string, checked: boolean) => {
    const cur = filters.verificationBadges ?? [];
    const next = checked ? [...cur, val] : cur.filter(v => v !== val);
    update({ verificationBadges: next.length ? next : undefined });
  };

  const clearAll = () => { onFiltersChange({}); setStateSearch(''); };

  const hasActive = Object.keys(filters).some(k => {
    const v = filters[k as keyof FilterState];
    return v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0);
  });

  const activePreset = PRICE_PRESETS.find(
    p => p.min === (filters.priceMin ?? 0) && p.max === (filters.priceMax ?? PRICE_MAX),
  );

  const priceMin = filters.priceMin ?? 0;
  const priceMax = filters.priceMax ?? PRICE_MAX;

  const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border-b border-gray-200 pb-5">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );

  const Content = () => (
    <div className="space-y-5">

      {/* ── Price Range ── */}
      <FilterSection title="Price Range">
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-gray-600 font-medium">
            <span>{formatPrice(priceMin)}</span>
            <span>{formatPrice(priceMax)}</span>
          </div>

          {/* Min slider */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Min price</label>
            <input
              type="range" min={0} max={PRICE_MAX} step={1000}
              value={priceMin}
              onChange={e => {
                const v = Number(e.target.value);
                update({ priceMin: v || undefined, priceMax: Math.max(v + 1000, priceMax) });
              }}
              className="w-full accent-blue-600 cursor-pointer"
              disabled={isLoading}
            />
          </div>

          {/* Max slider */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Max price</label>
            <input
              type="range" min={0} max={PRICE_MAX} step={1000}
              value={priceMax}
              onChange={e => {
                const v = Number(e.target.value);
                update({ priceMax: v >= PRICE_MAX ? undefined : v, priceMin: Math.min(priceMin, v - 1000) || undefined });
              }}
              className="w-full accent-blue-600 cursor-pointer"
              disabled={isLoading}
            />
          </div>

          {/* Quick-select presets */}
          <div className="flex gap-2 flex-wrap">
            {PRICE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => update({ priceMin: p.min || undefined, priceMax: p.max >= PRICE_MAX ? undefined : p.max })}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  activePreset?.label === p.label
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                }`}
                disabled={isLoading}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </FilterSection>

      {/* ── State ── */}
      <FilterSection title="State">
        <div className="space-y-2">
          <input
            type="text" placeholder="Search states…"
            value={stateSearch}
            onChange={e => setStateSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {/* Clear state option */}
            {filters.state && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="state" value=""
                  checked={false}
                  onChange={() => update({ state: undefined })}
                  className="text-blue-600" disabled={isLoading}
                />
                <span className="text-blue-600 font-medium">Clear state filter</span>
              </label>
            )}
            {INDIAN_STATES.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase())).map(s => (
              <label key={s} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1">
                <input type="radio" name="state" value={s}
                  checked={filters.state === s}
                  onChange={() => update({ state: s })}
                  className="text-blue-600" disabled={isLoading}
                />
                <span className="text-gray-700">{s}</span>
              </label>
            ))}
          </div>
        </div>
      </FilterSection>

      {/* ── Seller Type ── */}
      <FilterSection title="Seller Type">
        <div className="space-y-2">
          {SELLER_TYPES.map(t => (
            <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1">
              <input type="checkbox"
                checked={filters.sellerTypes?.includes(t.value) ?? false}
                onChange={e => toggleSellerType(t.value, e.target.checked)}
                className="rounded text-blue-600" disabled={isLoading}
              />
              <span className="text-gray-700">{t.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* ── Verification ── */}
      <FilterSection title="Verification">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1">
            <input type="checkbox"
              checked={filters.verifiedOnly ?? false}
              onChange={e => update({ verifiedOnly: e.target.checked || undefined })}
              className="rounded text-blue-600" disabled={isLoading}
            />
            <span className="text-gray-700">Verified Sellers Only</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1">
            <input type="checkbox"
              checked={filters.iecGlobal ?? false}
              onChange={e => update({ iecGlobal: e.target.checked || undefined })}
              className="rounded text-blue-600" disabled={isLoading}
            />
            <span className="text-gray-700">IEC Global Exporters</span>
          </label>

          <div className="border-t border-gray-100 pt-2 mt-1 space-y-2">
            <p className="text-xs font-medium text-gray-500">Badges</p>
            {VERIFICATION_BADGES.map(b => (
              <label key={b.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1">
                <input type="checkbox"
                  checked={filters.verificationBadges?.includes(b.value) ?? false}
                  onChange={e => toggleBadge(b.value, e.target.checked)}
                  className="rounded text-blue-600" disabled={isLoading}
                />
                <span className="text-gray-700">{b.label}</span>
              </label>
            ))}
          </div>
        </div>
      </FilterSection>

      {hasActive && (
        <button onClick={clearAll}
          className="w-full py-2 border border-red-200 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors"
          disabled={isLoading}>
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden mb-4">
        <button onClick={() => setMobileOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
          <span>Filters {hasActive && <span className="ml-1 text-blue-600">●</span>}</span>
          <span>{mobileOpen ? '▲' : '▼'}</span>
        </button>
        {mobileOpen && (
          <div className="mt-2 bg-white p-4 rounded-lg border border-gray-200">
            <Content />
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden lg:block">
        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Filters</h2>
            {hasActive && (
              <button onClick={clearAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium" disabled={isLoading}>
                Clear all
              </button>
            )}
          </div>
          <Content />
        </div>
      </div>
    </>
  );
};

export default ProductFilters;
