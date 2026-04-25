'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AdminShell from '../components/AdminShell';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('adminAccessToken') ?? ''}` };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface TicketSummary {
  id: string;
  subject: string;
  category: string;
  status: string;
  slaDeadline: string | null;
  slaBreach: boolean;
  escalatedAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; email: string; role: string };
  reportedUser: { id: string; email: string; role: string };
  _count: { responses: number };
}

interface Response {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  responder: { id: string; email: string; adminRole: string | null };
}

interface TicketDetail extends TicketSummary {
  description: string;
  adminNotes: string | null;
  orderId: string | null;
  escalatedBy: string | null;
  escalatedTo: string | null;
  responses: Response[];
}

interface Stats {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  slaBreaches: number;
  avgResolutionHours: number;
  total: number;
}

const STATUS_COLS = [
  { key: 'OPEN',        label: 'Open',        color: 'border-t-red-400',    badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  { key: 'IN_PROGRESS', label: 'In Progress',  color: 'border-t-yellow-400', badge: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' },
  { key: 'RESOLVED',    label: 'Resolved',     color: 'border-t-green-400',  badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  { key: 'CLOSED',      label: 'Closed',       color: 'border-t-gray-400',   badge: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
];

const CATEGORY_COLORS: Record<string, string> = {
  FRAUD:           'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
  PRODUCT_QUALITY: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
  PAYMENT:         'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  DELIVERY:        'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  OTHER:           'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
};

// ── SLA timer display ────────────────────────────────────────────────────────

function SlaTimer({ deadline, breach }: { deadline: string | null; breach: boolean }) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  const hoursLeft = diff / 3600000;

  if (breach || hoursLeft < 0) {
    const hoursOver = Math.abs(Math.round(hoursLeft));
    return <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">🔴 {hoursOver}h overdue</span>;
  }
  if (hoursLeft < 6) {
    return <span className="text-xs font-semibold text-orange-500 dark:text-orange-400 flex items-center gap-1">🟠 {Math.round(hoursLeft)}h left</span>;
  }
  return <span className="text-xs text-gray-400 dark:text-gray-500">{Math.round(hoursLeft)}h remaining</span>;
}

// ── Ticket card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, onClick }: { ticket: TicketSummary; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${
        ticket.slaBreach
          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      {ticket.slaBreach && (
        <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
          ⚠️ SLA BREACH
        </div>
      )}
      {ticket.escalatedAt && (
        <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">↑ Escalated</div>
      )}
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2 mb-2">{ticket.subject}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[ticket.category] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
          {ticket.category.replace('_', ' ')}
        </span>
        {ticket._count.responses > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
            {ticket._count.responses} response{ticket._count.responses !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 truncate">From: {ticket.reporter.email}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(ticket.createdAt).toLocaleDateString('en-IN')}</span>
        <SlaTimer deadline={ticket.slaDeadline} breach={ticket.slaBreach} />
      </div>
    </div>
  );
}

// ── Ticket detail modal ───────────────────────────────────────────────────────

function TicketModal({
  ticket,
  onClose,
  onRefresh,
}: {
  ticket: TicketDetail;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [message, setMessage]             = useState('');
  const [newStatus, setNewStatus]         = useState(ticket.status);
  const [adminNotes, setAdminNotes]       = useState(ticket.adminNotes ?? '');
  const [isInternal, setIsInternal]       = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [showEscalate, setShowEscalate]   = useState(false);
  const [error, setError]                 = useState('');

  const handleRespond = async () => {
    if (!message.trim()) { setError('Message is required'); return; }
    setSubmitting(true); setError('');
    try {
      await axios.post(
        `${API}/api/admin/complaints/${ticket.id}/respond`,
        { message, status: newStatus !== ticket.status ? newStatus : undefined, adminNotes: adminNotes || undefined, isInternal },
        { headers: authHeaders() },
      );
      setMessage('');
      onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  const handleEscalate = async () => {
    if (escalateReason.trim().length < 10) { setError('Reason must be at least 10 characters'); return; }
    setSubmitting(true); setError('');
    try {
      await axios.post(
        `${API}/api/admin/complaints/${ticket.id}/escalate`,
        { reason: escalateReason },
        { headers: authHeaders() },
      );
      setShowEscalate(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Escalation failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-3xl my-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 mr-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[ticket.category] ?? 'bg-gray-100 dark:bg-gray-700'}`}>
                {ticket.category.replace('_', ' ')}
              </span>
              {ticket.slaBreach && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold">SLA BREACH</span>
              )}
              {ticket.escalatedAt && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-semibold">Escalated</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{ticket.subject}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">#{ticket.id.slice(-8).toUpperCase()} · Filed {new Date(ticket.createdAt).toLocaleString('en-IN')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none p-1">✕</button>
        </div>

        <div className="p-6 grid grid-cols-3 gap-6">
          {/* Left: details + history */}
          <div className="col-span-2 space-y-5">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-3">
                <p className="text-gray-500 dark:text-gray-400 mb-0.5">Filed by (Reporter)</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{ticket.reporter.email}</p>
                <p className="text-gray-400 dark:text-gray-500">{ticket.reporter.role}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 rounded-xl p-3">
                <p className="text-gray-500 dark:text-gray-400 mb-0.5">Against (Reported)</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{ticket.reportedUser.email}</p>
                <p className="text-gray-400 dark:text-gray-500">{ticket.reportedUser.role}</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Description</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                {ticket.description}
              </p>
            </div>

            {/* Response history */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                Response History ({ticket.responses.length})
              </p>
              {ticket.responses.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">No responses yet</p>
              ) : (
                <div className="space-y-3">
                  {ticket.responses.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-xl p-4 text-sm ${
                        r.isInternal
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50'
                          : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium text-gray-700 dark:text-gray-300 text-xs">{r.responder.email}</span>
                        <div className="flex items-center gap-2">
                          {r.isInternal && (
                            <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full font-semibold">
                              Internal Note
                            </span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(r.createdAt).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{r.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Respond form */}
            {ticket.status !== 'CLOSED' && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800/50">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Add Response</p>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded"
                    />
                    <span className={isInternal ? 'text-yellow-700 dark:text-yellow-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}>
                      Internal note (not shown to user)
                    </span>
                  </label>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className={`w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400 text-gray-800 dark:text-gray-200 ${
                    isInternal
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder={isInternal ? 'Internal admin note — not visible to the complainant…' : 'Type your response to the user…'}
                />
                {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                <div className="flex items-center gap-2 mt-3">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  >
                    <option value="OPEN">Keep: OPEN</option>
                    <option value="IN_PROGRESS">Set: IN PROGRESS</option>
                    <option value="RESOLVED">Set: RESOLVED</option>
                    <option value="CLOSED">Set: CLOSED</option>
                  </select>
                  <button
                    onClick={handleRespond}
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-1.5 rounded-lg disabled:opacity-50 font-medium"
                  >
                    {submitting ? 'Submitting…' : isInternal ? 'Save Note' : 'Send Response'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: metadata + actions */}
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-xs space-y-2">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Ticket Info</p>
              <div><span className="text-gray-500 dark:text-gray-400">Status</span><p className="font-medium text-gray-800 dark:text-gray-200">{ticket.status.replace('_', ' ')}</p></div>
              {ticket.orderId && <div><span className="text-gray-500 dark:text-gray-400">Order ID</span><p className="font-mono text-gray-700 dark:text-gray-300">{ticket.orderId.slice(-8).toUpperCase()}</p></div>}
              {ticket.slaDeadline && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">SLA Deadline</span>
                  <div className="mt-0.5"><SlaTimer deadline={ticket.slaDeadline} breach={ticket.slaBreach} /></div>
                </div>
              )}
              {ticket.resolvedAt && <div><span className="text-gray-500 dark:text-gray-400">Resolved</span><p className="text-gray-700 dark:text-gray-300">{new Date(ticket.resolvedAt).toLocaleDateString('en-IN')}</p></div>}
            </div>

            {/* Admin notes */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Admin Notes</p>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20 text-gray-800 dark:text-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-blue-400"
                placeholder="Internal notes (saved with response)…"
              />
            </div>

            {/* Escalate */}
            {!ticket.escalatedAt && ticket.status !== 'CLOSED' && (
              <div>
                {!showEscalate ? (
                  <button
                    onClick={() => setShowEscalate(true)}
                    className="w-full text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-700 rounded-xl py-2 text-xs font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    ↑ Escalate Ticket
                  </button>
                ) : (
                  <div className="border border-orange-300 dark:border-orange-700 rounded-xl p-3 bg-orange-50 dark:bg-orange-900/20">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">Escalation Reason</p>
                    <textarea
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      rows={3}
                      className="w-full border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-2 py-1.5 text-xs resize-none focus:outline-none"
                      placeholder="Why is this being escalated? (min. 10 chars)"
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleEscalate} disabled={submitting} className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded disabled:opacity-50 font-medium">
                        {submitting ? '…' : 'Escalate'}
                      </button>
                      <button onClick={() => setShowEscalate(false)} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {ticket.escalatedAt && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-3 text-xs">
                <p className="font-semibold text-orange-700 dark:text-orange-400">↑ Escalated</p>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5">{new Date(ticket.escalatedAt).toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminComplaintsPage() {
  const router = useRouter();
  const [stats, setStats]                   = useState<Stats | null>(null);
  const [tickets, setTickets]               = useState<TicketSummary[]>([]);
  const [slaBreaches, setSlaBreaches]       = useState<TicketSummary[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail]   = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [breachOnly, setBreachOnly]         = useState(false);
  const [search, setSearch]                 = useState('');

  const load = useCallback(async () => {
    const token = localStorage.getItem('adminAccessToken');
    if (!token) { router.push('/admin/login'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (breachOnly) params.set('slaBreach', 'true');
      if (search) params.set('search', search);
      params.set('limit', '100');

      const [statsRes, ticketsRes, breachRes] = await Promise.all([
        axios.get(`${API}/api/admin/complaints/stats`, { headers: authHeaders() }),
        axios.get(`${API}/api/admin/complaints?${params}`, { headers: authHeaders() }),
        axios.get(`${API}/api/admin/complaints/sla-breaches`, { headers: authHeaders() }),
      ]);
      setStats(statsRes.data.data);
      setTickets(ticketsRes.data.data.items);
      setSlaBreaches(breachRes.data.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) router.push('/admin/login');
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, categoryFilter, breachOnly, search]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/api/admin/complaints/${id}`, { headers: authHeaders() });
      setSelectedTicket(res.data.data);
    } finally { setLoadingDetail(false); }
  };

  const refreshDetail = async () => {
    if (!selectedTicket) return;
    const res = await axios.get(`${API}/api/admin/complaints/${selectedTicket.id}`, { headers: authHeaders() });
    setSelectedTicket(res.data.data);
    load();
  };

  const ticketsByStatus = (status: string) => tickets.filter((t) => t.status === status);

  return (
    <AdminShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Complaint Resolution</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Consumer Protection Rules 2020 — 48h SLA</p>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Open',           value: stats.open,                color: 'text-red-600 dark:text-red-400' },
              { label: 'In Progress',    value: stats.inProgress,          color: 'text-yellow-600 dark:text-yellow-400' },
              { label: 'Resolved',       value: stats.resolved,            color: 'text-green-600 dark:text-green-400' },
              { label: 'Closed',         value: stats.closed,              color: 'text-gray-500 dark:text-gray-400' },
              { label: 'SLA Breaches',   value: stats.slaBreaches,         color: 'text-red-700 dark:text-red-400' },
              { label: 'Avg Resolution', value: `${stats.avgResolutionHours}h`, color: 'text-blue-600 dark:text-blue-400' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* SLA breach banner */}
        {slaBreaches.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-4 mb-6">
            <p className="font-bold text-red-700 dark:text-red-400 text-sm mb-3">
              🔴 {slaBreaches.length} SLA Breach{slaBreaches.length !== 1 ? 'es' : ''} — Immediate Action Required
            </p>
            <div className="flex flex-wrap gap-2">
              {slaBreaches.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openDetail(t.id)}
                  className="bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-800 dark:text-red-300 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-left"
                >
                  <span className="block">{t.subject.slice(0, 40)}{t.subject.length > 40 ? '…' : ''}</span>
                  <span className="text-red-500 dark:text-red-400">{t.reporter.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:border-blue-400"
            placeholder="Search subject or email…"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="">All Categories</option>
            {['FRAUD', 'PRODUCT_QUALITY', 'PAYMENT', 'DELIVERY', 'OTHER'].map((c) => (
              <option key={c} value={c}>{c.replace('_', ' ')}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={breachOnly} onChange={(e) => setBreachOnly(e.target.checked)} className="rounded" />
            <span className="text-red-600 dark:text-red-400 font-medium">SLA Breaches Only</span>
          </label>
        </div>

        {/* Kanban board */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATUS_COLS.map((col) => {
              const colTickets = ticketsByStatus(col.key);
              return (
                <div key={col.key} className={`bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl border-t-4 ${col.color} p-4`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">{col.label}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${col.badge}`}>
                      {colTickets.length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                    {colTickets.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">No tickets</p>
                    ) : (
                      colTickets.map((t) => (
                        <TicketCard key={t.id} ticket={t} onClick={() => openDetail(t.id)} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading detail spinner overlay */}
        {loadingDetail && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Ticket detail modal */}
        {selectedTicket && (
          <TicketModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onRefresh={refreshDetail}
          />
        )}
      </div>
    </AdminShell>
  );
}
