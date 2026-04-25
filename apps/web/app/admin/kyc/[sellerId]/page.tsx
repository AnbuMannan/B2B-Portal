'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import AdminShell from '../../components/AdminShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
const hdrs = () => ({ Authorization: `Bearer ${localStorage.getItem('adminAccessToken')}` });

interface KycDoc {
  id: string; documentType: string; fileUrl: string; fileName: string; mimeType: string; uploadedAt: string;
}
interface GovResult {
  valid: boolean; legalName?: string; state?: string; registrationDate?: string;
  panType?: string; iec?: string; error?: string; raw?: Record<string, unknown>;
}
interface SellerDetail {
  id: string; companyName: string; companyType: string; state: string | null; city: string | null;
  pincode: string | null; gstNumber: string | null; panNumber: string | null; iecCode: string | null;
  hasIEC: boolean; udyamNumber: string | null; directorName: string | null;
  directorDesignation: string | null; aadhaarLastFour: string | null; kycStatus: string;
  registeredAddress: Record<string, string> | null; businessAddress: Record<string, string> | null;
  industryType: string[]; businessModel: string | null; kycDocuments: KycDoc[];
  user: { id: string; email: string; phoneNumber: string | null; createdAt: string };
  govApiResults: { gstin: GovResult | null; pan: GovResult | null; iec: GovResult | null };
  sla: { elapsedHours: number; hoursRemaining: number; deadline: string };
}

const DOC_LABELS: Record<string, string> = {
  GST_CERTIFICATE: 'GST Certificate', PAN_CARD: 'PAN Card', IEC_CERTIFICATE: 'IEC Certificate',
  UDYAM: 'Udyam Certificate', ISO: 'ISO Certificate', DRUG_LICENCE: 'Drug Licence',
  FSSAI: 'FSSAI Certificate', DIRECTOR_PHOTO: 'Director Photo',
};

function GovPanel({ result, label, number }: { result: GovResult | null; label: string; number?: string | null }) {
  if (!result && !number) {
    return (
      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">{label} — Not submitted</p>
      </div>
    );
  }
  const valid = result?.valid ?? false;
  return (
    <div className={`p-3 rounded-lg border ${valid
      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-sm font-bold ${valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {valid ? '✓' : '✗'}
        </span>
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</span>
        {number && <span className="text-xs font-mono text-gray-500 dark:text-gray-400 ml-auto">{number}</span>}
      </div>
      {valid && result && (
        <div className="space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          {result.legalName && <p><span className="font-medium">Name:</span> {result.legalName}</p>}
          {result.state && <p><span className="font-medium">State:</span> {result.state}</p>}
          {result.registrationDate && <p><span className="font-medium">Reg date:</span> {result.registrationDate}</p>}
          {result.panType && <p><span className="font-medium">PAN type:</span> {result.panType}</p>}
          {result.iec && <p><span className="font-medium">IEC:</span> {result.iec}</p>}
        </div>
      )}
      {!valid && result?.error && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">{result.error}</p>
      )}
    </div>
  );
}

export default function KycDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sellerId = params.sellerId as string;

  const [seller, setSeller] = useState<SellerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<KycDoc | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('adminAccessToken');
    if (!token) { router.push('/admin/login'); return; }
    axios.get(`${API_URL}/api/admin/kyc/${sellerId}`, { headers: hdrs() })
      .then((r) => {
        setSeller(r.data.data);
        if (r.data.data?.kycDocuments?.length) setActiveDoc(r.data.data.kycDocuments[0]);
      })
      .catch((e) => {
        if ([401, 403].includes(e?.response?.status)) { router.push('/admin/login'); return; }
        setError(e?.response?.data?.message ?? 'Failed to load KYC details');
      })
      .finally(() => setLoading(false));
  }, [sellerId, router]);

  const handleAction = async () => {
    if (!confirmAction) return;
    if (confirmAction === 'reject' && rejectionReason.trim().length < 10) {
      setActionError('Rejection reason must be at least 10 characters.'); return;
    }
    setSubmitting(true); setActionError(null);
    try {
      if (confirmAction === 'approve') {
        await axios.post(`${API_URL}/api/admin/kyc/${sellerId}/approve`, {}, { headers: hdrs() });
      } else {
        await axios.post(`${API_URL}/api/admin/kyc/${sellerId}/reject`, { rejectionReason }, { headers: hdrs() });
      }
      router.push('/admin/kyc');
    } catch (e: unknown) {
      setActionError((e as {response?: {data?: {message?: string}}})?.response?.data?.message ?? 'Action failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <AdminShell>
      <div className="flex items-center justify-center h-full p-20">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminShell>
  );

  if (error || !seller) return (
    <AdminShell>
      <div className="p-6">
        <p className="text-red-500 dark:text-red-400">{error ?? 'Seller not found'}</p>
        <button onClick={() => router.back()} className="text-blue-600 dark:text-blue-400 text-sm mt-2 hover:underline">← Back</button>
      </div>
    </AdminShell>
  );

  const isPending = seller.kycStatus === 'PENDING';
  const slaColor = seller.sla.elapsedHours < 24 ? 'text-green-600 dark:text-green-400'
    : seller.sla.elapsedHours < 42 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  const field = (label: string, value: string | null | undefined) => (
    <div key={label}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 dark:text-gray-200 font-mono mt-0.5 break-all">{value || '—'}</p>
    </div>
  );

  return (
    <AdminShell>
      <div className="p-6 space-y-5 max-w-screen-2xl">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => router.push('/admin/kyc')}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 mb-2">
              ← KYC Queue
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{seller.companyName}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400">{seller.user.email}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                seller.kycStatus === 'APPROVED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : seller.kycStatus === 'REJECTED' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'}`}>
                {seller.kycStatus}
              </span>
              {isPending && (
                <span className={`text-xs font-medium ${slaColor}`}>
                  {seller.sla.elapsedHours}h elapsed · {seller.sla.hoursRemaining}h remaining (deadline {new Date(seller.sla.deadline).toLocaleString('en-IN')})
                </span>
              )}
            </div>
          </div>
          {isPending && (
            <div className="flex gap-3 flex-shrink-0">
              <button onClick={() => { setConfirmAction('reject'); setActionError(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                Reject
              </button>
              <button onClick={() => { setConfirmAction('approve'); setActionError(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors">
                Approve KYC
              </button>
            </div>
          )}
        </div>

        {/* 3-column layout: company info | document list + viewer | gov api */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Col 1: Company + Director info */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Company Details</h2>
              <div className="grid grid-cols-2 gap-3">
                {field('Company Type', seller.companyType?.replace('_', ' '))}
                {field('Business Model', seller.businessModel)}
                {field('Industries', seller.industryType?.join(', '))}
                {field('City', seller.city)}
                {field('State', seller.state)}
                {field('Pincode', seller.pincode)}
                {field('GSTIN', seller.gstNumber)}
                {field('PAN', seller.panNumber)}
                {field('IEC Code', seller.iecCode)}
                {field('Udyam No.', seller.udyamNumber)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Director / Owner</h2>
              <div className="grid grid-cols-2 gap-3">
                {field('Name', seller.directorName)}
                {field('Designation', seller.directorDesignation)}
                {field('Aadhaar (last 4)', seller.aadhaarLastFour ? `XXXX-XXXX-${seller.aadhaarLastFour}` : null)}
              </div>
            </div>

            {seller.registeredAddress && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Registered Address</h2>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {Object.values(seller.registeredAddress).filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Account</h2>
              <div className="grid grid-cols-1 gap-2">
                {field('Email', seller.user.email)}
                {field('Phone', seller.user.phoneNumber)}
                {field('Registered', new Date(seller.user.createdAt).toLocaleDateString('en-IN'))}
              </div>
            </div>
          </div>

          {/* Col 2: Document split-pane */}
          <div className="xl:col-span-1 flex flex-col gap-4">
            {/* Document list */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Documents <span className="text-gray-400 dark:text-gray-500 font-normal">({seller.kycDocuments.length})</span>
              </h2>
              {seller.kycDocuments.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">No documents uploaded.</p>
              ) : (
                <div className="space-y-2">
                  {seller.kycDocuments.map((doc) => (
                    <button key={doc.id} onClick={() => setActiveDoc(doc)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        activeDoc?.id === doc.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/70'}`}>
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        {doc.mimeType === 'application/pdf'
                          ? <span className="text-xs font-bold text-red-500 dark:text-red-400">PDF</span>
                          : <span className="text-xs font-bold text-blue-500 dark:text-blue-400">IMG</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {DOC_LABELS[doc.documentType] ?? doc.documentType}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{doc.fileName}</p>
                      </div>
                      <span className="text-gray-400 dark:text-gray-600 text-xs">›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Inline viewer */}
            {activeDoc && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {DOC_LABELS[activeDoc.documentType] ?? activeDoc.documentType}
                  </h3>
                  <a href={`${API_URL}${activeDoc.fileUrl}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    Open ↗
                  </a>
                </div>
                {activeDoc.mimeType === 'application/pdf' ? (
                  <iframe src={`${API_URL}${activeDoc.fileUrl}`}
                    className="w-full h-80 rounded-lg border border-gray-200 dark:border-gray-700"
                    title={activeDoc.fileName} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${API_URL}${activeDoc.fileUrl}`} alt={activeDoc.fileName}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 object-contain max-h-80" />
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Uploaded {new Date(activeDoc.uploadedAt).toLocaleString('en-IN')}
                </p>
              </div>
            )}
          </div>

          {/* Col 3: Government API verification */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Government API Results
              </h2>
              <div className="space-y-3">
                <GovPanel result={seller.govApiResults.gstin} label="GSTIN Verification" number={seller.gstNumber} />
                <GovPanel result={seller.govApiResults.pan} label="PAN Verification" number={seller.panNumber} />
                {seller.hasIEC && (
                  <GovPanel result={seller.govApiResults.iec} label="IEC Verification" number={seller.iecCode} />
                )}
                {seller.udyamNumber && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">Udyam Registration</p>
                    <p className="text-xs font-mono text-blue-700 dark:text-blue-300">{seller.udyamNumber}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Certificate on file — manual cross-check required</p>
                  </div>
                )}
              </div>
            </div>

            {/* Raw gov API JSON — for REVIEWER deep-dive */}
            {Object.values(seller.govApiResults).some(Boolean) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Raw API Responses</h2>
                <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64">
                  {JSON.stringify(seller.govApiResults, null, 2)}
                </pre>
              </div>
            )}

            {/* SLA timer */}
            {isPending && (
              <div className={`rounded-xl border p-5 ${seller.sla.elapsedHours >= 42
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : seller.sla.elapsedHours >= 24
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">SLA Status</h2>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Elapsed</span>
                    <span className={`font-semibold ${slaColor}`}>{seller.sla.elapsedHours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Remaining</span>
                    <span className={`font-semibold ${slaColor}`}>{seller.sla.hoursRemaining}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Deadline</span>
                    <span className="text-gray-700 dark:text-gray-300 text-xs">
                      {new Date(seller.sla.deadline).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      seller.sla.elapsedHours >= 42 ? 'bg-red-500' : seller.sla.elapsedHours >= 24 ? 'bg-yellow-500' : 'bg-green-500'
                    }`} style={{ width: `${Math.min(100, (seller.sla.elapsedHours / 48) * 100)}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirm modal */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                {confirmAction === 'approve' ? 'Approve KYC' : 'Reject KYC'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {confirmAction === 'approve'
                  ? `Approve KYC for "${seller.companyName}"? This marks the seller verified and creates their lead credit wallet.`
                  : `Reject KYC for "${seller.companyName}". Provide a clear reason — it will be sent to the seller.`}
              </p>
              {confirmAction === 'reject' && (
                <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4}
                  placeholder="e.g. GST certificate name does not match PAN cardholder name. Please upload matching documents."
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-1" />
              )}
              {actionError && <p className="text-red-500 dark:text-red-400 text-xs mb-3">{actionError}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setConfirmAction(null); setRejectionReason(''); setActionError(null); }}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleAction} disabled={submitting}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    confirmAction === 'approve' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}>
                  {submitting
                    ? (confirmAction === 'approve' ? 'Approving…' : 'Rejecting…')
                    : (confirmAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
