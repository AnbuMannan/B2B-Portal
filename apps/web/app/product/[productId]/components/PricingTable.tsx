interface PricingTier {
  tier: string;
  price: number;
  moq: number;
}

interface Props {
  tiers: PricingTier[];
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  RETAIL: { label: 'Retail', color: 'bg-gray-50' },
  WHOLESALE: { label: 'Wholesale', color: 'bg-blue-50' },
  BULK: { label: 'Bulk', color: 'bg-green-50' },
  TIER1: { label: 'Retail', color: 'bg-gray-50' },
  TIER2: { label: 'Wholesale', color: 'bg-blue-50' },
  TIER3: { label: 'Bulk', color: 'bg-green-50' },
};

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PricingTable({ tiers }: Props) {
  if (!tiers || tiers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm text-gray-500 text-center">
          Contact seller for pricing details
        </p>
      </div>
    );
  }

  // Find the tier with the lowest price to badge as "Best Value"
  const lowestPriceTier = tiers.reduce((prev, curr) =>
    curr.price < prev.price ? curr : prev,
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Pricing &amp; MOQ</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Prices are indicative — get a quote for exact pricing
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2 text-left font-medium">Tier</th>
            <th className="px-4 py-2 text-right font-medium">Price</th>
            <th className="px-4 py-2 text-right font-medium">Min. Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tiers.map((tier) => {
            const meta = TIER_LABELS[tier.tier.toUpperCase()] ?? {
              label: tier.tier,
              color: 'bg-white',
            };
            const isBestValue = tier.tier === lowestPriceTier.tier && tiers.length > 1;

            return (
              <tr key={tier.tier} className={`${meta.color} transition-colors`}>
                <td className="px-4 py-3 font-medium text-gray-800">
                  <span className="flex items-center gap-1.5">
                    {meta.label}
                    {isBestValue && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-green-600 text-white">
                        Best
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {formatINR(tier.price)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {tier.moq.toLocaleString('en-IN')} units
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
