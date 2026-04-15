'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface Transaction {
  id: string;
  type: 'PURCHASE' | 'SPEND' | 'REFUND';
  credits: number;
  amount: number;
  baseAmount: number | null;
  gstAmount: number | null;
  totalAmount: number | null;
  status: string;
  packId: string | null;
  invoiceNumber: string | null;
  invoicePath: string | null;
  createdAt: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

const TYPE_CONFIG = {
  PURCHASE: {
    label: 'Purchase',
    sign: '+',
    creditClass: 'text-green-600 font-semibold',
    badgeClass: 'bg-green-100 text-green-700',
  },
  SPEND: {
    label: 'Lead Reveal',
    sign: '-',
    creditClass: 'text-red-500 font-semibold',
    badgeClass: 'bg-red-100 text-red-600',
  },
  REFUND: {
    label: 'Refund',
    sign: '+',
    creditClass: 'text-blue-600 font-semibold',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
};

const STATUS_CLASS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PENDING:   'bg-yellow-100 text-yellow-700',
  FAILED:    'bg-red-100 text-red-600',
};

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

  const fmtAmt = (n: number | null) =>
    n != null
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
      : '—';

  const downloadInvoice = async (txnId: string, invoiceNumber: string) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}/api/seller/wallet/invoice/${txnId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${invoiceNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-gray-500 text-sm">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
            <th className="text-right py-3 px-4 font-medium text-gray-600">Credits</th>
            <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">Invoice</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((t) => {
            const cfg = TYPE_CONFIG[t.type] ?? TYPE_CONFIG.PURCHASE;
            return (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                {/* Date */}
                <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                  {fmtDate(t.createdAt)}
                </td>

                {/* Type badge */}
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badgeClass}`}>
                    {cfg.label}
                  </span>
                </td>

                {/* Credits */}
                <td className={`py-3 px-4 text-right tabular-nums ${cfg.creditClass}`}>
                  {cfg.sign}{t.credits || 1}
                </td>

                {/* Amount */}
                <td className="py-3 px-4 text-right text-gray-700 tabular-nums">
                  {t.type === 'PURCHASE' ? (
                    <div>
                      <p className="font-medium">{fmtAmt(t.totalAmount)}</p>
                      {t.gstAmount != null && (
                        <p className="text-xs text-gray-400">incl. GST {fmtAmt(t.gstAmount)}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">1 credit</span>
                  )}
                </td>

                {/* Status */}
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {t.status === 'COMPLETED' ? 'Completed' : t.status === 'PENDING' ? 'Pending' : 'Failed'}
                  </span>
                </td>

                {/* Invoice download — show for all PURCHASE txns with an invoice number */}
                <td className="py-3 px-4">
                  {t.type === 'PURCHASE' && t.invoiceNumber ? (
                    <button
                      type="button"
                      onClick={() => downloadInvoice(t.id, t.invoiceNumber!)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {t.invoiceNumber}
                    </button>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
