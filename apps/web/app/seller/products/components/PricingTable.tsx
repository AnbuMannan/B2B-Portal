/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Controller, useFormContext } from 'react-hook-form';

interface PricingTableProps {
  /** Optional: read-only display mode */
  readOnly?: boolean;
}

const TIERS = [
  {
    key: 'retail' as const,
    label: 'Retail',
    description: 'Single unit / small orders',
    color: 'blue',
  },
  {
    key: 'wholesale' as const,
    label: 'Wholesale',
    description: 'Mid-volume orders',
    color: 'purple',
  },
  {
    key: 'bulk' as const,
    label: 'Bulk',
    description: 'Large volume orders',
    color: 'green',
  },
];

export default function PricingTable({ readOnly = false }: PricingTableProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <p className="text-sm font-medium text-gray-700">Multi-Tier Pricing</p>
        <p className="text-xs text-gray-500 mt-0.5">At least one tier must be enabled</p>
      </div>

      <div className="divide-y divide-gray-100">
        {TIERS.map((tier) => {
          const basePath = `multiTierPricing.${tier.key}`;
          const enabledVal = watch(`${basePath}.enabled`);

          return (
            <div
              key={tier.key}
              className={`p-4 transition-colors ${
                enabledVal ? 'bg-white' : 'bg-gray-50 opacity-60'
              }`}
            >
              {/* Tier header row */}
              <div className="flex items-center gap-3 mb-3">
                <Controller
                  control={control}
                  name={`${basePath}.enabled`}
                  defaultValue={false}
                  render={({ field }) => (
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => field.onChange(!field.value)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                        field.value ? 'bg-blue-600' : 'bg-gray-300'
                      } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                          field.value ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  )}
                />
                <div>
                  <span className="text-sm font-semibold text-gray-800">{tier.label}</span>
                  <span className="text-xs text-gray-400 ml-2">{tier.description}</span>
                </div>
              </div>

              {/* Price & MOQ inputs */}
              <div className="grid grid-cols-2 gap-4 pl-12">
                {/* Price */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Price (₹) {enabledVal && <span className="text-red-500">*</span>}
                  </label>
                  <Controller
                    control={control}
                    name={`${basePath}.price`}
                    defaultValue=""
                    render={({ field }) => (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                        <input
                          {...field}
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!enabledVal || readOnly}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    )}
                  />
                  {(errors?.multiTierPricing as any)?.[tier.key]?.price && (
                    <p className="text-red-500 text-xs mt-1">
                      {(errors?.multiTierPricing as any)[tier.key].price.message}
                    </p>
                  )}
                </div>

                {/* MOQ */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Min. Order Qty {enabledVal && <span className="text-red-500">*</span>}
                  </label>
                  <Controller
                    control={control}
                    name={`${basePath}.moq`}
                    defaultValue=""
                    render={({ field }) => (
                      <input
                        {...field}
                        type="number"
                        min="1"
                        disabled={!enabledVal || readOnly}
                        placeholder="e.g. 10"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    )}
                  />
                  {(errors?.multiTierPricing as any)?.[tier.key]?.moq && (
                    <p className="text-red-500 text-xs mt-1">
                      {(errors?.multiTierPricing as any)[tier.key].moq.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
