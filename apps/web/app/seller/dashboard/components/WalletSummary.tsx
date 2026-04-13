import Link from 'next/link';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
  referenceId: string;
}

interface WalletData {
  balance: number;
  lastRechargeDate: string | null;
  lowBalanceAlert: boolean;
  recentTransactions: Transaction[];
}

interface WalletSummaryProps {
  wallet: WalletData;
}

const TXN_TYPE_CONFIG: Record<string, { label: string; color: string; sign: string }> = {
  PURCHASE: { label: 'Recharge', color: 'text-green-600', sign: '+' },
  SPEND: { label: 'Lead Reveal', color: 'text-red-600', sign: '-' },
  REFUND: { label: 'Refund', color: 'text-blue-600', sign: '+' },
};

export default function WalletSummary({ wallet }: WalletSummaryProps) {
  const lastRecharge = wallet.lastRechargeDate
    ? new Date(wallet.lastRechargeDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className={`bg-white rounded-xl border p-6 ${
        wallet.lowBalanceAlert ? 'border-orange-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-900">Wallet & Credits</h2>
        <Link
          href="/seller/wallet"
          className="text-sm text-blue-600 hover:underline"
        >
          View all →
        </Link>
      </div>

      {/* Balance display */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-1">Available Balance</p>
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold text-gray-900">{wallet.balance}</p>
          <p className="text-sm text-gray-500">credits</p>
        </div>
        {lastRecharge && (
          <p className="text-xs text-gray-400 mt-1">Last recharge: {lastRecharge}</p>
        )}
      </div>

      {/* Low balance alert */}
      {wallet.lowBalanceAlert && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-4">
          <svg className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-orange-700">
            Low balance! Recharge to continue revealing buyer contacts.
          </p>
        </div>
      )}

      <Link
        href="/seller/wallet/recharge"
        className="block w-full text-center bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors mb-5"
      >
        + Recharge Credits
      </Link>

      {/* Recent transactions */}
      {wallet.recentTransactions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Recent Transactions
          </p>
          <div className="space-y-2">
            {wallet.recentTransactions.map((txn) => {
              const config = TXN_TYPE_CONFIG[txn.type] ?? {
                label: txn.type,
                color: 'text-gray-600',
                sign: '',
              };
              return (
                <div key={txn.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{config.label}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${config.color}`}>
                    {config.sign}{Math.abs(txn.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
