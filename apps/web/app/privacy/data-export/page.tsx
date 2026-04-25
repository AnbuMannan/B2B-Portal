'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface ExportRequest {
  id: string;
  status: string;
  fileUrl: string | null;
  expiresAt: string | null;
  requestedAt: string;
  completedAt: string | null;
  errorMsg: string | null;
}

function authHeader() {
  const token = localStorage.getItem('accessToken');
  return { Authorization: `Bearer ${token}` };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    QUEUED: 'bg-yellow-100 text-yellow-700',
    PROCESSING: 'bg-blue-100 text-blue-700',
    READY: 'bg-green-100 text-green-700',
    EXPIRED: 'bg-gray-100 text-gray-500',
    FAILED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-400',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

export default function DataExportPage() {
  const router = useRouter();

  // Read ?request= from URL client-side only (avoids useSearchParams Suspense requirement)
  const prefillRequest = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('request')
    : null;

  const [requests, setRequests] = useState<ExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pollingId, setPollingId] = useState<string | null>(prefillRequest);

  const load = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/signin'); return; }

    // Load history of export requests via consent history (we'll use status endpoint)
    // Since there's no "list all exports" endpoint, we track locally
    const stored = JSON.parse(localStorage.getItem('exportRequests') ?? '[]') as string[];
    const loaded: ExportRequest[] = [];
    for (const id of stored.slice(-5)) {
      try {
        const res = await axios.get(`${API}/api/compliance/data-export/${id}`, { headers: authHeader() });
        loaded.push(res.data.data);
      } catch { /* skip deleted/expired */ }
    }
    setRequests(loaded.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // Poll active request
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/compliance/data-export/${pollingId}`, { headers: authHeader() });
        const req: ExportRequest = res.data.data;
        setRequests((prev) => {
          const idx = prev.findIndex((r) => r.id === pollingId);
          if (idx >= 0) { const next = [...prev]; next[idx] = req; return next; }
          return [req, ...prev];
        });
        if (['READY', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(req.status)) {
          setPollingId(null);
        }
      } catch { setPollingId(null); }
    }, 8000);
    return () => clearInterval(interval);
  }, [pollingId]);

  const requestExport = async () => {
    setRequesting(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`${API}/api/compliance/data-export`, {}, { headers: authHeader() });
      const { requestId } = res.data.data;
      // Track locally
      const stored = JSON.parse(localStorage.getItem('exportRequests') ?? '[]') as string[];
      if (!stored.includes(requestId)) {
        localStorage.setItem('exportRequests', JSON.stringify([...stored, requestId]));
      }
      setPollingId(requestId);
      setSuccess('Export queued! We will email you a download link within 30 minutes.');
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to queue export');
    } finally { setRequesting(false); }
  };

  const downloadExport = (req: ExportRequest) => {
    if (!req.fileUrl) return;
    // In production this would be a signed URL redirect
    const a = document.createElement('a');
    a.href = req.fileUrl;
    a.download = `b2b-data-export-${req.id.slice(-8)}.json`;
    a.click();
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Loading…</p></div>;

  const hasActiveRequest = requests.some((r) => ['QUEUED', 'PROCESSING'].includes(r.status));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-6">
          <Link href="/privacy" className="text-sm text-blue-600 hover:underline">← Privacy Policy</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Export My Data</h1>
          <p className="text-sm text-gray-500 mt-1">
            Download a copy of all your personal data in JSON format. Your right under DPDP Act §12.
          </p>
        </div>

        {/* Request export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-2">Request Data Export</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your export will include: profile, business details (sellers), orders, transactions, buy leads,
            saved items, and consent history. Financial records are included in anonymized form.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-xs text-gray-600 space-y-1">
            <p>📦 <strong>Includes:</strong> Profile · Business info · Orders · Transactions · Buy leads · Consents</p>
            <p>⏱ <strong>Processing time:</strong> Usually ready within 30 minutes</p>
            <p>🔗 <strong>Download link validity:</strong> 24 hours after ready</p>
            <p>📧 <strong>Notification:</strong> Email sent when ready</p>
          </div>

          {error && <div className="mb-4 bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}
          {success && <div className="mb-4 bg-green-50 text-green-700 text-sm px-4 py-2 rounded-lg">{success}</div>}

          <button
            onClick={requestExport}
            disabled={requesting || hasActiveRequest}
            className="bg-blue-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {requesting ? 'Queueing…' : hasActiveRequest ? 'Export already in progress' : 'Request Data Export'}
          </button>
        </div>

        {/* Previous requests */}
        {requests.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Export History</h2>
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={req.status} />
                      {['QUEUED', 'PROCESSING'].includes(req.status) && (
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested {new Date(req.requestedAt).toLocaleString('en-IN')}
                    </p>
                    {req.expiresAt && req.status === 'READY' && (
                      <p className="text-xs text-orange-500 mt-0.5">
                        Expires {new Date(req.expiresAt).toLocaleString('en-IN')}
                      </p>
                    )}
                    {req.errorMsg && <p className="text-xs text-red-500 mt-0.5">{req.errorMsg}</p>}
                  </div>
                  {req.status === 'READY' && req.fileUrl && (
                    <button
                      onClick={() => downloadExport(req)}
                      className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                    >
                      Download JSON
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-400 text-center">
          Exercising your right under DPDP Act 2023 §12 — Right to Data Portability
        </div>
      </div>
    </div>
  );
}

