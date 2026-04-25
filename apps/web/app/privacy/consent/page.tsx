'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
const POLICY_VERSION = 'v2024.1';

interface ConsentState {
  consentType: string;
  isActive: boolean;
  version: string | null;
  givenAt: string | null;
  withdrawnAt: string | null;
}

interface ConsentRecord {
  id: string;
  consentType: string;
  version: string;
  givenAt: string;
  withdrawnAt: string | null;
}

const CONSENT_INFO: Record<string, { label: string; description: string; essential: boolean }> = {
  ESSENTIAL: {
    label: 'Essential Services',
    description: 'Required for account login, security, and core platform functionality. Cannot be withdrawn (DPDP Act §7 — deemed consent for contracted services).',
    essential: true,
  },
  MARKETING: {
    label: 'Marketing Communications',
    description: 'Promotional emails, product recommendations, offers, and market updates. You can withdraw this at any time.',
    essential: false,
  },
  ANALYTICS: {
    label: 'Usage Analytics',
    description: 'Anonymous data on how you use the platform helps us improve features. Fully anonymized upon withdrawal.',
    essential: false,
  },
  DATA_SHARING: {
    label: 'Data Sharing with Partners',
    description: 'Sharing anonymized usage data with trusted analytics partners for market research. Never includes PII.',
    essential: false,
  },
};

function authHeader() {
  const token = localStorage.getItem('accessToken');
  return { Authorization: `Bearer ${token}` };
}

export default function ConsentPage() {
  const router = useRouter();
  const [currentState, setCurrentState] = useState<ConsentState[]>([]);
  const [history, setHistory] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin'); return; }
    try {
      const res = await axios.get(`${API}/api/compliance/consent`, { headers: authHeader() });
      setCurrentState(res.data.data.currentState);
      setHistory(res.data.data.history);
    } catch {
      router.push('/auth/signin');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const giveConsent = async (consentType: string) => {
    setProcessing(consentType);
    try {
      await axios.post(`${API}/api/compliance/consent`, { consentType, version: POLICY_VERSION }, { headers: authHeader() });
      await load();
    } finally { setProcessing(null); }
  };

  const withdrawConsent = async (consentType: string) => {
    if (!confirm(`Withdraw ${CONSENT_INFO[consentType]?.label} consent? This will take effect immediately.`)) return;
    setProcessing(consentType);
    try {
      await axios.post(`${API}/api/compliance/consent/withdraw`, { consentType }, { headers: authHeader() });
      await load();
    } finally { setProcessing(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Loading consent settings…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-6">
          <Link href="/privacy" className="text-sm text-blue-600 hover:underline">← Privacy Policy</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Manage Consents</h1>
          <p className="text-sm text-gray-500 mt-1">
            Control how your personal data is used. DPDP Act §6 — you have the right to give and withdraw consent.
          </p>
        </div>

        <div className="space-y-4">
          {currentState.map((c) => {
            const info = CONSENT_INFO[c.consentType];
            return (
              <div key={c.consentType} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800 text-sm">{info?.label ?? c.consentType}</h3>
                      {info?.essential && (
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Required</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{info?.description}</p>
                    {c.isActive && c.givenAt && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ Consented on {new Date(c.givenAt).toLocaleDateString('en-IN')} (Policy {c.version})
                      </p>
                    )}
                    {!c.isActive && c.withdrawnAt && (
                      <p className="text-xs text-gray-400 mt-2">
                        Withdrawn on {new Date(c.withdrawnAt).toLocaleDateString('en-IN')}
                      </p>
                    )}
                    {!c.isActive && !c.givenAt && (
                      <p className="text-xs text-gray-400 mt-2">Not yet given</p>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {info?.essential ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-5 bg-blue-600 rounded-full relative">
                          <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                        </div>
                        <span className="text-xs text-gray-500">On</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => c.isActive ? withdrawConsent(c.consentType) : giveConsent(c.consentType)}
                        disabled={processing === c.consentType}
                        className="flex items-center gap-1.5 disabled:opacity-50"
                        aria-label={`${c.isActive ? 'Withdraw' : 'Give'} ${info?.label} consent`}
                      >
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${c.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${c.isActive ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                        <span className="text-xs text-gray-500">{c.isActive ? 'On' : 'Off'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* History */}
        <div className="mt-8">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showHistory ? 'Hide' : 'View'} consent history ({history.length} records)
          </button>

          {showHistory && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500">Type</th>
                    <th className="px-4 py-2 text-left text-gray-500">Given</th>
                    <th className="px-4 py-2 text-left text-gray-500">Withdrawn</th>
                    <th className="px-4 py-2 text-left text-gray-500">Policy</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium">{h.consentType}</td>
                      <td className="px-4 py-2 text-gray-600">{new Date(h.givenAt).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-gray-400">{h.withdrawnAt ? new Date(h.withdrawnAt).toLocaleString('en-IN') : '—'}</td>
                      <td className="px-4 py-2 text-gray-400">{h.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
          <strong>Your rights under the DPDP Act 2023:</strong> You can withdraw non-essential consents at any time.
          Withdrawal does not affect the lawfulness of processing before withdrawal.
          Essential services consent cannot be withdrawn as it is necessary for contract performance (DPDP §7).
        </div>
      </div>
    </div>
  );
}
