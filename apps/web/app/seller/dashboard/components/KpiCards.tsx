import Link from 'next/link';

interface KpiData {
  leadCreditBalance: number;
  activeListings: number;
  pendingListings: number;
  profileViews7d: number;
  profileViews30d: number;
  enquiriesReceived: number;
  activeOrders: number;
}

interface KpiCardsProps {
  kpis: KpiData;
  lowBalance: boolean;
}

function KpiCard({
  label,
  value,
  sub,
  linkHref,
  linkLabel,
  highlight,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  linkHref?: string;
  linkLabel?: string;
  highlight?: 'warning' | 'success';
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-5 flex flex-col gap-3 ${
        highlight === 'warning'
          ? 'border-orange-200 bg-orange-50'
          : highlight === 'success'
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            highlight === 'warning'
              ? 'bg-orange-100 text-orange-600'
              : highlight === 'success'
              ? 'bg-green-100 text-green-600'
              : 'bg-blue-100 text-blue-600'
          }`}
        >
          {icon}
        </div>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            {linkLabel} →
          </Link>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function KpiCards({ kpis, lowBalance }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Lead Credits"
        value={kpis.leadCreditBalance}
        sub={lowBalance ? '⚠ Low balance' : undefined}
        linkHref="/seller/wallet/recharge"
        linkLabel="Recharge"
        highlight={lowBalance ? 'warning' : undefined}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      <KpiCard
        label="Active Listings"
        value={kpis.activeListings}
        sub={kpis.pendingListings > 0 ? `${kpis.pendingListings} pending approval` : undefined}
        linkHref="/seller/products"
        linkLabel="View"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
      />

      <KpiCard
        label="Profile Views (30d)"
        value={kpis.profileViews30d.toLocaleString('en-IN')}
        sub={`${kpis.profileViews7d.toLocaleString('en-IN')} in last 7 days`}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        }
      />

      <KpiCard
        label="Enquiries Received"
        value={kpis.enquiriesReceived}
        sub={`${kpis.activeOrders} active order${kpis.activeOrders !== 1 ? 's' : ''}`}
        linkHref="/seller/orders"
        linkLabel="Orders"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        }
      />
    </div>
  );
}
