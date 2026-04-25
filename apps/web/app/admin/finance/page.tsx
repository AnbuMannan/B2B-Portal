'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import AdminShell from '../components/AdminShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface Overview {
  totalRevenue30d: number;
  totalCreditsIssued30d: number;
  totalCreditsSpent30d: number;
  facilitationFees30d: number;
  refundsProcessed30d: number;
  gstCollected: { cgst: number; sgst: number; igst: number; total: number };
  topSellersBySpend: { seller: { companyName: string; gstNumber: string }; totalSpend: number; totalCredits: number }[];
  revenueByDay: { date: string; revenue: number }[];
}

interface Transaction {
  id: string;
  type: string;
  credits: number;
  baseAmount: string | null;
  gstAmount: string | null;
  totalAmount: string | null;
  status: string;
  invoiceNumber: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
  seller: { companyName: string; gstNumber: string | null; state: string | null };
}

type ActiveTab = 'overview' | 'transactions' | 'invoices' | 'refund';

const GST_COLORS = ['#3b82f6', '#8b5cf6', '#10b981'];
const INR = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function AdminFinancePage() {
  const router = useRouter();
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnPage, setTxnPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundResult, setRefundResult] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

  const token = () => localStorage.getItem('adminAccessToken') ?? '';
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/finance/overview`, { headers: headers() });
      setOverview(res.data.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) { router.push('/admin/login'); return; }
      setError('Failed to load overview');
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(txnPage));
      params.set('limit', '20');
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await axios.get(`${API_URL}/api/admin/finance/transactions?${params}`, { headers: headers() });
      setTransactions(res.data.data.items);
      setTxnTotal(res.data.data.total);
    } catch { setError('Failed to load transactions'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnPage, search, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!token()) { router.push('/admin/login'); return; }
    if (tab === 'overview') fetchOverview();
    if (tab === 'transactions') fetchTransactions();
  }, [tab, fetchOverview, fetchTransactions, router]);

  const handleExport = async (type: 'gstr1' | 'ledger') => {
    const endpoint = type === 'gstr1' ? 'gstr1-export' : 'ledger-export';
    const params = type === 'ledger' && (dateFrom || dateTo)
      ? `?from=${dateFrom}&to=${dateTo}`
      : type === 'gstr1' ? `?period=${new Date().toISOString().slice(0, 7)}` : '';

    const res = await fetch(`${API_URL}/api/admin/finance/${endpoint}${params}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') ?? `${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefundError(null);
    setRefundResult(null);
    if (!refundPaymentId.trim() || !refundReason.trim()) return;
    setRefundSubmitting(true);
    try {
      const body: Record<string, unknown> = { razorpayPaymentId: refundPaymentId.trim(), reason: refundReason.trim() };
      if (refundAmount) body.amountPaise = Math.round(parseFloat(refundAmount) * 100);
      const res = await axios.post(`${API_URL}/api/admin/finance/refund`, body, { headers: headers() });
      const d = res.data.data;
      setRefundResult(`Refund ${d.refundId} processed — ₹${d.amountRefunded} (${d.status})`);
      setRefundPaymentId(''); setRefundReason(''); setRefundAmount('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setRefundError(msg ?? 'Refund failed');
    } finally { setRefundSubmitting(false); }
  };

  const gstPieData = overview ? [
    { name: 'CGST (9%)', value: overview.gstCollected.cgst },
    { name: 'SGST (9%)', value: overview.gstCollected.sgst },
    { name: 'IGST (18%)', value: overview.gstCollected.igst },
  ].filter((d) => d.value > 0) : [];

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'refund', label: 'Process Refund' },
  ];

  return (
    <AdminShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Financial Dashboard</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">Revenue, GST compliance, and transaction management</p>
          </div>
          {(tab === 'overview' || tab === 'transactions') && (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('gstr1')}
                className="px-3 py-2 bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs rounded-lg font-medium transition-colors"
              >
                ↓ GSTR-1 CSV
              </button>
              <button
                onClick={() => handleExport('ledger')}
                className="px-3 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 text-xs rounded-lg font-medium transition-colors"
              >
                ↓ Full Ledger CSV
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && overview && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Revenue (30d)', value: INR(overview.totalRevenue30d), color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'GST Collected', value: INR(overview.gstCollected.total), color: 'text-blue-600 dark:text-blue-400' },
                { label: 'Credits Issued', value: overview.totalCreditsIssued30d.toLocaleString(), color: 'text-purple-600 dark:text-purple-400' },
                { label: 'Credits Spent', value: overview.totalCreditsSpent30d.toLocaleString(), color: 'text-yellow-600 dark:text-yellow-400' },
                { label: 'Refunds (30d)', value: INR(overview.refundsProcessed30d), color: 'text-red-600 dark:text-red-400' },
              ].map((m) => (
                <div key={m.label} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                  <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Line chart */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Daily Revenue (Base, excl. GST)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={overview.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:[stroke:#1e293b]" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                      labelStyle={{ color: '#374151' }}
                      formatter={(v) => [INR(Number(v)), 'Revenue']}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* GST pie */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">GST Breakdown</h2>
                {gstPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={gstPieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {gstPieData.map((_, i) => (
                          <Cell key={i} fill={GST_COLORS[i % GST_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => <span style={{ color: '#6b7280', fontSize: 11 }}>{v}</span>}
                      />
                      <Tooltip
                        contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                        formatter={(v) => [INR(Number(v))]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400 dark:text-slate-500 text-sm">No GST data</div>
                )}
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-500 dark:text-slate-400"><span>CGST (9%)</span><span>{INR(overview.gstCollected.cgst)}</span></div>
                  <div className="flex justify-between text-gray-500 dark:text-slate-400"><span>SGST (9%)</span><span>{INR(overview.gstCollected.sgst)}</span></div>
                  <div className="flex justify-between text-gray-500 dark:text-slate-400"><span>IGST (18%)</span><span>{INR(overview.gstCollected.igst)}</span></div>
                  <div className="flex justify-between text-gray-900 dark:text-white font-semibold pt-1 border-t border-gray-100 dark:border-slate-800"><span>Total GST</span><span>{INR(overview.gstCollected.total)}</span></div>
                </div>
              </div>
            </div>

            {/* Top sellers */}
            {overview.topSellersBySpend.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Top Sellers by Spend (All Time)</h2>
                <div className="space-y-2">
                  {overview.topSellersBySpend.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-800 last:border-0">
                      <div>
                        <p className="text-gray-800 dark:text-slate-200 text-sm font-medium">{s.seller.companyName}</p>
                        <p className="text-gray-400 dark:text-slate-500 text-xs font-mono">{s.seller.gstNumber ?? '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">{INR(s.totalSpend)}</p>
                        <p className="text-gray-400 dark:text-slate-500 text-xs">{s.totalCredits} credits</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TRANSACTIONS ── */}
        {tab === 'transactions' && !loading && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
              <input
                type="text"
                placeholder="Search invoice, payment ID, company…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setTxnPage(1); }}
                className="flex-1 min-w-[200px] px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setTxnPage(1); }}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="PURCHASE">Purchase</option>
                <option value="SPEND">Spend</option>
                <option value="REFUND">Refund</option>
              </select>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setTxnPage(1); }}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm focus:outline-none" />
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setTxnPage(1); }}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm focus:outline-none" />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 text-left bg-gray-50 dark:bg-transparent">
                      {['Date', 'Company', 'Type', 'Credits', 'Base', 'GST', 'Total', 'Invoice', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {transactions.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No transactions found</td></tr>
                    ) : transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-gray-400 dark:text-slate-400 text-xs whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800 dark:text-slate-200 truncate max-w-[140px]">{t.seller.companyName}</p>
                          <p className="text-gray-400 dark:text-slate-600 text-xs font-mono truncate">{t.seller.gstNumber ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            t.type === 'PURCHASE' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                            t.type === 'REFUND' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' :
                            'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                          }`}>{t.type}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300 text-center">{t.credits}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                          {t.baseAmount ? INR(Number(t.baseAmount)) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                          {t.gstAmount ? INR(Number(t.gstAmount)) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                          {t.totalAmount ? INR(Number(t.totalAmount)) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 dark:text-slate-400 text-xs font-mono">
                          {t.invoiceNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            t.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                            t.status === 'REFUNDED' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' :
                            'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                          }`}>{t.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {txnTotal > 20 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-800">
                  <p className="text-gray-400 dark:text-slate-500 text-xs">{txnTotal} total</p>
                  <div className="flex gap-2">
                    <button
                      disabled={txnPage === 1}
                      onClick={() => setTxnPage((p) => p - 1)}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs rounded-lg disabled:opacity-40"
                    >← Prev</button>
                    <button
                      disabled={txnPage * 20 >= txnTotal}
                      onClick={() => setTxnPage((p) => p + 1)}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs rounded-lg disabled:opacity-40"
                    >Next →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INVOICES ── */}
        {tab === 'invoices' && !loading && (
          <InvoicesTab token={token()} />
        )}

        {/* ── REFUND ── */}
        {tab === 'refund' && (
          <div className="max-w-lg">
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Process Refund</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-5">
                Initiates refund via Razorpay and creates a REFUND transaction record.
              </p>

              <form onSubmit={handleRefund} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Razorpay Payment ID</label>
                  <input
                    type="text"
                    value={refundPaymentId}
                    onChange={(e) => setRefundPaymentId(e.target.value)}
                    placeholder="pay_xxxxxxxxxxxxxxxxxx"
                    required
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Refund Amount (₹) <span className="text-gray-400 dark:text-slate-500 font-normal">— leave blank for full refund</span>
                  </label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="e.g. 1770.00"
                    min="1"
                    step="0.01"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Reason (internal)</label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="e.g. Duplicate payment; seller requested refund"
                    rows={3}
                    required
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {refundError && <p className="text-red-500 dark:text-red-400 text-sm">{refundError}</p>}
                {refundResult && (
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-lg px-4 py-3 text-sm">
                    {refundResult}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={refundSubmitting || !refundPaymentId || !refundReason}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  {refundSubmitting ? 'Processing refund…' : 'Process Refund'}
                </button>
              </form>
            </div>

            <div className="mt-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl px-4 py-3">
              <p className="text-yellow-700 dark:text-yellow-400 text-xs font-medium">Refund policy reminder</p>
              <p className="text-yellow-600/80 dark:text-yellow-300/70 text-xs mt-0.5">
                Refunds deduct credits from the seller wallet. GST refunds must be reported in GSTR-1. Obtain written approval before processing refunds above ₹10,000.
              </p>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  credits: number;
  seller: { companyName: string; gstNumber: string | null };
}

function InvoicesTab({ token }: { token: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/admin/finance/invoices?page=${page}&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      setInvoices(res.data.data.items);
      setTotal(res.data.data.total);
    }).finally(() => setLoading(false));
  }, [page, token]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-transparent">
            {['Invoice No', 'Date', 'Company', 'GSTIN', 'Base', 'GST', 'Total', 'Credits'].map((h) => (
              <th key={h} className="px-4 py-3 text-gray-500 dark:text-slate-400 font-medium text-left whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {invoices.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No invoices found</td></tr>
          ) : invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-3 text-gray-700 dark:text-slate-300 font-mono text-xs">{inv.invoiceNumber}</td>
              <td className="px-4 py-3 text-gray-400 dark:text-slate-400 text-xs whitespace-nowrap">{new Date(inv.createdAt).toLocaleDateString('en-IN')}</td>
              <td className="px-4 py-3 text-gray-800 dark:text-slate-200 truncate max-w-[150px]">{inv.seller.companyName}</td>
              <td className="px-4 py-3 text-gray-400 dark:text-slate-500 font-mono text-xs">{inv.seller.gstNumber ?? '—'}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">₹{Number(inv.baseAmount ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">₹{Number(inv.gstAmount ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3 text-gray-900 dark:text-white font-medium whitespace-nowrap">₹{Number(inv.totalAmount ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-slate-300 text-center">{inv.credits}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > 20 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-800">
          <p className="text-gray-400 dark:text-slate-500 text-xs">{total} total</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs rounded-lg disabled:opacity-40">← Prev</button>
            <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs rounded-lg disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
