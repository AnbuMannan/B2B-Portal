'use client';

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  perCreditCost: number;
}

interface PackSelectionProps {
  packs: CreditPack[];
  selectedPackId: string | null;
  onSelect: (packId: string) => void;
  onProceed: () => void;
  loading: boolean;
}

const BEST_VALUE_PACK = 'standard';

export default function PackSelection({
  packs,
  selectedPackId,
  onSelect,
  onProceed,
  loading,
}: PackSelectionProps) {
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Select a Credit Pack</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Prices exclusive of 18% GST &nbsp;·&nbsp; Credits never expire
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {packs.map((pack) => {
          const isBest     = pack.id === BEST_VALUE_PACK;
          const isSelected = pack.id === selectedPackId;

          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => onSelect(pack.id)}
              className={`relative text-left border-2 rounded-xl p-5 transition-all focus:outline-none ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              {/* Best Value badge */}
              {isBest && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full whitespace-nowrap">
                  Best Value
                </span>
              )}

              {/* Pack name */}
              <p className={`text-sm font-semibold mb-3 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                {pack.name}
              </p>

              {/* Credit count */}
              <p className={`text-4xl font-bold mb-1 ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                {pack.credits}
                <span className="text-base font-medium ml-1">credits</span>
              </p>

              {/* Price */}
              <p className="text-lg font-semibold text-gray-900 mt-2">
                {fmtCurrency(pack.baseAmount)}
              </p>
              <p className="text-xs text-gray-400">+ {fmtCurrency(pack.gstAmount)} GST</p>
              <p className="text-sm font-medium text-gray-700 mt-1">
                Total: {fmtCurrency(pack.totalAmount)}
              </p>

              {/* Per-credit cost */}
              <p className="text-xs text-gray-400 mt-2 border-t border-gray-100 pt-2">
                ≈ {fmtCurrency(pack.perCreditCost)}/credit
              </p>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* GST note */}
      <p className="text-xs text-gray-400">
        * 18% GST will be levied on all credit packs as per Indian tax regulations.
        A GST-compliant tax invoice will be generated after payment.
      </p>

      {/* Proceed button */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!selectedPackId || loading}
          onClick={onProceed}
          className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing…
            </>
          ) : (
            'Proceed to Payment'
          )}
        </button>
      </div>
    </div>
  );
}
