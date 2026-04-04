'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface CreditWidgetProps {
  accessToken?: string;
  refreshKey?: number;
}

export function CreditWidget({ accessToken, refreshKey = 0 }: CreditWidgetProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setIsLoading(true);

    fetch(`${API_BASE}/api/buy-leads/wallet-balance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data.balance);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [accessToken, refreshKey]);

  const isLow = balance !== null && balance < 5;

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium ring-1 ${
      isLow ? 'bg-orange-50 text-orange-800 ring-orange-200' : 'bg-white text-gray-700 ring-gray-200'
    }`}>
      {isLow ? (
        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
      ) : (
        <Coins className="h-4 w-4 text-primary shrink-0" />
      )}

      {isLoading ? (
        <span className="text-gray-400">Loading...</span>
      ) : (
        <span>
          Credits:{' '}
          <strong className={isLow ? 'text-orange-700' : 'text-gray-900'}>
            {balance ?? 0}
          </strong>
        </span>
      )}

      <Link
        href="/seller/wallet/recharge"
        className="ml-1 text-primary hover:underline font-semibold"
      >
        Recharge →
      </Link>
    </div>
  );
}
