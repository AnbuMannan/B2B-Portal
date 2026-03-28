'use client';

import { useState } from 'react';

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

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const SELLER_TYPES = [
  { value: 'Manufacturer', label: 'Manufacturer' },
  { value: 'Wholesaler', label: 'Wholesaler' },
  { value: 'Distributor', label: 'Distributor' },
  { value: 'Retailer', label: 'Retailer' }
];

const VERIFICATION_BADGES = [
  { value: 'GST Verified', label: 'GST Verified' },
  { value: 'IEC Global', label: 'IEC Global' },
  { value: 'MSME', label: 'MSME Registered' }
];

const ProductFilters = ({ filters, onFiltersChange, isLoading = false }: ProductFiltersProps) => {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleFilterChange = (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handlePriceRangeChange = (min: number, max: number) => {
    onFiltersChange({
      ...filters,
      priceMin: min,
      priceMax: max
    });
  };

  const handleSellerTypeChange = (sellerType: string, checked: boolean) => {
    const currentTypes = filters.sellerTypes || [];
    const newTypes = checked
      ? [...currentTypes, sellerType]
      : currentTypes.filter(type => type !== sellerType);

    onFiltersChange({
      ...filters,
      sellerTypes: newTypes.length > 0 ? newTypes : undefined
    });
  };

  const handleVerificationBadgeChange = (badge: string, checked: boolean) => {
    const currentBadges = filters.verificationBadges || [];
    const newBadges = checked
      ? [...currentBadges, badge]
      : currentBadges.filter(b => b !== badge);

    onFiltersChange({
      ...filters,
      verificationBadges: newBadges.length > 0 ? newBadges : undefined
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
    setSearchTerm('');
  };

  const filteredStates = INDIAN_STATES.filter(state =>
    state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof FilterState];
    return value !== undefined && 
           value !== '' && 
           (!Array.isArray(value) || value.length > 0);
  });

  const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border-b border-gray-200 pb-4">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Price Range Filter */}
      <FilterSection title="Price Range">
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>₹{filters.priceMin?.toLocaleString('en-IN') || '0'}</span>
            <span>₹{filters.priceMax?.toLocaleString('en-IN') || '1 Cr'}</span>
          </div>
          
          <div className="relative pt-1">
            <input
              type="range"
              min="0"
              max="10000000"
              step="1000"
              value={filters.priceMin || 0}
              onChange={(e) => handlePriceRangeChange(Number(e.target.value), filters.priceMax || 10000000)}
              className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
              disabled={isLoading}
            />
            <input
              type="range"
              min="0"
              max="10000000"
              step="1000"
              value={filters.priceMax || 10000000}
              onChange={(e) => handlePriceRangeChange(filters.priceMin || 0, Number(e.target.value))}
              className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: '₹0-10K', min: 0, max: 10000 },
              { label: '₹10K-1L', min: 10000, max: 100000 },
              { label: '₹1L+', min: 100000, max: 10000000 }
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePriceRangeChange(preset.min, preset.max)}
                className="px-2 py-1 border border-gray-300 rounded-md text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                disabled={isLoading}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </FilterSection>

      {/* State Filter */}
      <FilterSection title="State">
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search states..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredStates.map((state) => (
              <label key={state} className="flex items-center space-x-2 text-sm">
                <input
                  type="radio"
                  name="state"
                  value={state}
                  checked={filters.state === state}
                  onChange={(e) => handleFilterChange('state', e.target.checked ? state : undefined)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <span className="text-gray-700">{state}</span>
              </label>
            ))}
          </div>
        </div>
      </FilterSection>

      {/* Seller Type Filter */}
      <FilterSection title="Seller Type">
        <div className="space-y-2">
          {SELLER_TYPES.map((type) => (
            <label key={type.value} className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={filters.sellerTypes?.includes(type.value) || false}
                onChange={(e) => handleSellerTypeChange(type.value, e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={isLoading}
              />
              <span className="text-gray-700">{type.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Verification Badges Filter */}
      <FilterSection title="Verification">
        <div className="space-y-3">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={filters.verifiedOnly || false}
              onChange={(e) => handleFilterChange('verifiedOnly', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={isLoading}
            />
            <span className="text-gray-700">Verified Sellers Only</span>
          </label>

          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={filters.iecGlobal || false}
              onChange={(e) => handleFilterChange('iecGlobal', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={isLoading}
            />
            <span className="text-gray-700">IEC Global Exporters</span>
          </label>

          <div className="border-t border-gray-200 pt-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">Badges:</p>
            {VERIFICATION_BADGES.map((badge) => (
              <label key={badge.value} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.verificationBadges?.includes(badge.value) || false}
                  onChange={(e) => handleVerificationBadgeChange(badge.value, e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <span className="text-gray-700">{badge.label}</span>
              </label>
            ))}
          </div>
        </div>
      </FilterSection>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          disabled={isLoading}
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>Filters {hasActiveFilters && '•'}</span>
          <span>{isMobileFiltersOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Desktop Filters */}
      <div className="hidden lg:block w-full">
        <div className="bg-white p-6 rounded-lg border border-gray-200 sticky top-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                disabled={isLoading}
              >
                Clear all
              </button>
            )}
          </div>
          <FilterContent />
        </div>
      </div>

      {/* Mobile Filters */}
      {isMobileFiltersOpen && (
        <div className="lg:hidden bg-white p-4 rounded-lg border border-gray-200 mb-4">
          <FilterContent />
        </div>
      )}
    </>
  );
};

export default ProductFilters;