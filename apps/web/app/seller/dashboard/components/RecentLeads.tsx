import Link from 'next/link';

interface Lead {
  id: string;
  productName: string;
  quantity: number | null;
  unit: string;
  expectedCountry: string;
  contactChannel: string;
  repeatOption: string;
  postedAt: string;
  expiryDate: string | null;
}

interface RecentLeadsProps {
  leads: Lead[];
}

const CHANNEL_ICONS: Record<string, string> = {
  WHATSAPP: '💬',
  TELEGRAM: '📨',
  EMAIL: '✉',
};

export default function RecentLeads({ leads }: RecentLeadsProps) {
  if (!leads.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Matching Buy Leads</h2>
        <div className="text-center py-8 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No matching buy leads right now</p>
          <Link href="/buy-leads" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
            Browse all buy leads →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Matching Buy Leads</h2>
        <Link href="/buy-leads" className="text-sm text-blue-600 hover:underline">
          Browse all →
        </Link>
      </div>

      <div className="space-y-3">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">{lead.productName}</p>
                {lead.repeatOption !== 'NONE' && (
                  <span className="flex-shrink-0 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                    Recurring
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {lead.quantity && (
                  <span className="text-xs text-gray-500">
                    Qty: {lead.quantity.toLocaleString('en-IN')} {lead.unit}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  📍 {lead.expectedCountry}
                </span>
                <span className="text-xs text-gray-500">
                  {CHANNEL_ICONS[lead.contactChannel] ?? '📞'} via {lead.contactChannel.toLowerCase()}
                </span>
              </div>
            </div>
            <Link
              href={`/buy-leads?highlight=${lead.id}`}
              className="flex-shrink-0 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
            >
              Reveal Contact
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
