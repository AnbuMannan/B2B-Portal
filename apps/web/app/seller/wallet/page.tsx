/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import PackSelection from './components/PackSelection';
import TransactionHistory from './components/TransactionHistory';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

// Razorpay is loaded via an external <script> tag at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let Razorpay: new (options: Record<string, unknown>) => { open(): void; on(event: string, handler: (resp: Record<string, unknown>) => void): void };

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  perCreditCost: number;
}

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

interface WalletData {
  balance: number;
  totalPurchased: number;
  totalSpent: number;
  lowBalance: boolean;
  transactions: Transaction[];
  packs: CreditPack[];
}

type ViewMode = 'wallet' | 'recharge';

interface MockOrder {
  razorpayOrderId: string;
  mockPaymentId:   string;
  mockSignature:   string;
  pack:            CreditPack;
  amount:          number;
}

export default function WalletPage() {
  const [wallet, setWallet]               = useState<WalletData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [view, setView]                   = useState<ViewMode>('wallet');
  const [selectedPack, setSelectedPack]   = useState<string | null>(null);
  const [orderLoading, setOrderLoading]   = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [mockOrder, setMockOrder]         = useState<MockOrder | null>(null);

  const authHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ── Load Razorpay JS SDK ──────────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('razorpay-sdk')) return;
    const script   = document.createElement('script');
    script.id      = 'razorpay-sdk';
    script.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async   = true;
    document.head.appendChild(script);
  }, []);

  // ── Fetch wallet data ─────────────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/seller/wallet`, {
        headers: authHeaders(),
      });
      setWallet(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const goToRecharge = () => {
    setOrderLoading(false);
    setMockOrder(null);
    setSelectedPack(null);
    setView('recharge');
  };

  // ── Initiate Razorpay checkout ────────────────────────────────────────────
  const handleProceedToPayment = async () => {
    if (!selectedPack) {
      toast.error('Please select a credit pack first.');
      return;
    }
    // Reset any stuck loading state from a previous failed attempt
    setOrderLoading(true);
    setMockOrder(null);

    try {
      // 1. Create order on the server
      const { data } = await axios.post(
        `${API_URL}/api/seller/wallet/create-order`,
        { packId: selectedPack },
        { headers: authHeaders() },
      );
      const order = data.data;

      // 2a. Mock mode — show sandbox dialog instead of Razorpay checkout
      if (order.isMock) {
        setMockOrder({
          razorpayOrderId: order.razorpayOrderId,
          mockPaymentId:   order.mockPaymentId,
          mockSignature:   order.mockSignature,
          pack:            order.pack,
          amount:          order.amount,
        });
        setOrderLoading(false);
        return;
      }

      // 2b. Real Razorpay checkout
      if (typeof Razorpay === 'undefined') {
        toast.error('Payment gateway not loaded. Please refresh and try again.');
        return;
      }

      const rzp = new Razorpay({
        key:         order.keyId,
        amount:      order.amount,
        currency:    order.currency,
        order_id:    order.razorpayOrderId,
        name:        'B2B Marketplace',
        description: `${order.pack.name} — ${order.pack.credits} Lead Credits`,
        prefill:     {},
        theme:       { color: '#2563EB' },

        handler: async (response: {
          razorpay_order_id:   string;
          razorpay_payment_id: string;
          razorpay_signature:  string;
        }) => {
          await verifyAndCredit(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature,
          );
        },

        modal: {
          ondismiss: () => {
            setOrderLoading(false);
          },
        },
      });

      rzp.on('payment.failed', (resp: any) => {
        toast.error(`Payment failed: ${resp.error?.description ?? 'Unknown error'}`);
        setOrderLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to create order';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setOrderLoading(false);
    }
  };

  // ── Verify payment + credit wallet ───────────────────────────────────────
  const verifyAndCredit = async (
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) => {
    setVerifyLoading(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/seller/wallet/verify-payment`,
        { razorpayOrderId, razorpayPaymentId, razorpaySignature },
        { headers: authHeaders() },
      );

      const result = data.data;
      // Clear spinner immediately — don't wait for wallet reload
      setVerifyLoading(false);
      setView('wallet');
      setSelectedPack(null);
      toast.success(
        `${result.creditsAdded} credits added! New balance: ${result.newBalance}`,
        { duration: 4000 },
      );
      // Refresh wallet in background (no await)
      fetchWallet();
    } catch (err: any) {
      setVerifyLoading(false);
      toast.error(err?.response?.data?.message ?? 'Payment verification failed');
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const fmtNum = (n: number) => n.toLocaleString('en-IN');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Toaster position="top-right" />

      {/* ── Low balance banner ──────────────────────────────────────────── */}
      {wallet?.lowBalance && wallet.balance > 0 && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              Low balance — {fmtNum(wallet.balance)} {wallet.balance === 1 ? 'credit' : 'credits'} remaining
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Recharge now to continue accessing buyer leads without interruption.
            </p>
          </div>
          <button
            onClick={goToRecharge}
            className="ml-auto text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-300 px-3 py-1 rounded-lg whitespace-nowrap"
          >
            Recharge
          </button>
        </div>
      )}

      {wallet?.balance === 0 && (
        <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-medium text-red-700">
            You have 0 credits. Recharge to continue accessing leads.
          </p>
          <button
            onClick={goToRecharge}
            className="ml-auto text-xs font-semibold text-red-700 hover:text-red-900 border border-red-200 px-3 py-1 rounded-lg whitespace-nowrap"
          >
            Recharge Now
          </button>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallet & Credits</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your lead credit balance and purchase history</p>
        </div>
        {view === 'wallet' && (
          <button
            onClick={goToRecharge}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Recharge
          </button>
        )}
        {view === 'recharge' && (
          <button
            onClick={() => setView('wallet')}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
      </div>

      {/* ── Wallet view ──────────────────────────────────────────────────── */}
      {view === 'wallet' && wallet && (
        <div className="space-y-6">
          {/* Balance hero card */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
            <p className="text-blue-100 text-sm font-medium">Available Credits</p>
            <p className="text-6xl font-extrabold mt-1 mb-4 tabular-nums">
              {fmtNum(wallet.balance)}
            </p>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-blue-200">Total Purchased</p>
                <p className="font-semibold text-white mt-0.5">{fmtNum(wallet.totalPurchased)}</p>
              </div>
              <div className="border-l border-blue-500 pl-6">
                <p className="text-blue-200">Total Spent</p>
                <p className="font-semibold text-white mt-0.5">{fmtNum(wallet.totalSpent)}</p>
              </div>
            </div>
          </div>

          {/* Transaction history */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Transaction History</h2>
              <p className="text-xs text-gray-500 mt-0.5">Last 20 transactions</p>
            </div>
            <TransactionHistory transactions={wallet.transactions} />
          </div>
        </div>
      )}

      {/* ── Recharge view ────────────────────────────────────────────────── */}
      {view === 'recharge' && wallet && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <PackSelection
            packs={wallet.packs}
            selectedPackId={selectedPack}
            onSelect={setSelectedPack}
            onProceed={handleProceedToPayment}
            loading={orderLoading || verifyLoading}
          />
        </div>
      )}

      {/* ── Mock payment sandbox dialog (always mounted at root) ─────────── */}
      {mockOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Test Mode</span>
              <span className="text-xs text-gray-400">No real money charged</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-3">Simulate Payment</h2>
            <p className="text-sm text-gray-500 mt-1">
              Razorpay credentials are not configured. This simulates a successful payment.
            </p>
            <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Pack</span>
                <span className="font-medium text-gray-900">{mockOrder.pack.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Credits</span>
                <span className="font-medium text-gray-900">{mockOrder.pack.credits.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount (incl. GST)</span>
                <span className="font-medium text-gray-900">
                  ₹{mockOrder.pack.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="text-gray-400 text-xs">Order ID</span>
                <span className="text-gray-400 text-xs font-mono truncate max-w-[160px]">{mockOrder.razorpayOrderId}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setMockOrder(null); setOrderLoading(false); }}
                className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const o = mockOrder;
                  setMockOrder(null);
                  await verifyAndCredit(o.razorpayOrderId, o.mockPaymentId, o.mockSignature);
                }}
                className="flex-1 bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Simulate Payment ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Verifying payment overlay (always mounted at root) ───────────── */}
      {verifyLoading && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-10 py-8 shadow-xl flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-gray-700 font-medium">Verifying payment…</p>
            <p className="text-gray-500 text-sm">Please do not close this window.</p>
          </div>
        </div>
      )}
    </div>
  );
}
