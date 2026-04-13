'use client';

import Link from 'next/link';

interface CreditUsage {
  spent30d: number;
  purchased30d: number;
  currentBalance: number;
  dailyBurnRate: number;
  daysToDepletion: number | null;
  depletionDate: string | null;
  criticalAlert: boolean;
}

interface CreditUsageCardProps {
  data: CreditUsage;
}

export function CreditUsageCard({ data }: CreditUsageCardProps) {
  const {
    currentBalance,
    spent30d,
    purchased30d,
    dailyBurnRate,
    daysToDepletion,
    depletionDate,
    criticalAlert,
  } = data;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // Build a simple bar: balance / (balance + spent) width
  const total = currentBalance + spent30d;
  const barPct = total > 0 ? Math.round((currentBalance / total) * 100) : 100;
  const barColor = criticalAlert ? 'bg-red-500' : barPct < 30 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className={`rounded-xl border p-5 ${criticalAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      {criticalAlert && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Credits running low — {daysToDepletion === 0 ? 'depleted today' : `${daysToDepletion} day${daysToDepletion === 1 ? '' : 's'} remaining`}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Credit Balance</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{currentBalance.toLocaleString()}</p>
          <p className="mt-0.5 text-sm text-gray-500">credits available</p>
        </div>
        <Link
          href="/seller/wallet"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Recharge
        </Link>
      </div>

      {/* Balance bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Balance</span>
          <span>{barPct}% remaining</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-gray-50 px-2 py-3">
          <p className="text-xs text-gray-500">Spent (30d)</p>
          <p className="mt-0.5 text-base font-semibold text-gray-800">{spent30d}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-2 py-3">
          <p className="text-xs text-gray-500">Purchased (30d)</p>
          <p className="mt-0.5 text-base font-semibold text-gray-800">{purchased30d}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-2 py-3">
          <p className="text-xs text-gray-500">Burn Rate</p>
          <p className="mt-0.5 text-base font-semibold text-gray-800">{dailyBurnRate}/day</p>
        </div>
      </div>

      {/* Depletion estimate */}
      {depletionDate && (
        <p className="mt-3 text-xs text-gray-500 text-center">
          Estimated depletion:{' '}
          <span className={`font-semibold ${criticalAlert ? 'text-red-600' : 'text-gray-700'}`}>
            {formatDate(depletionDate)}
          </span>
        </p>
      )}
    </div>
  );
}
