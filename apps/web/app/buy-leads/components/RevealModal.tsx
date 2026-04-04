'use client';

import { useEffect } from 'react';
import { X, Phone, Mail, MessageCircle, Copy, CheckCircle2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { BuyLead, RevealedContact } from '../BuyLeadsClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface RevealModalProps {
  lead: BuyLead;
  revealedContact: RevealedContact | null;
  walletBalance: number | null;
  isRevealing: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onViewRevealedLeads: () => void;
  accessToken?: string;
  onWalletLoaded: (balance: number) => void;
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 rounded p-1 text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

export function RevealModal({
  lead,
  revealedContact,
  walletBalance,
  isRevealing,
  onConfirm,
  onClose,
  onViewRevealedLeads,
  accessToken,
  onWalletLoaded,
}: RevealModalProps) {
  // Fetch wallet balance when modal opens
  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_BASE}/api/buy-leads/wallet-balance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) onWalletLoaded(json.data.balance);
      })
      .catch(() => {});
  }, [accessToken, onWalletLoaded]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {revealedContact ? 'Contact Details' : 'Reveal Contact'}
          </h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Lead summary */}
          <div className="mb-5 rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Requirement</p>
            <p className="mt-0.5 font-semibold text-gray-900">{lead.productName}</p>
            {lead.quantity != null && (
              <p className="text-sm text-gray-500">
                {lead.quantity} {lead.unit ?? ''} · {lead.expectedCountry}
              </p>
            )}
          </div>

          {revealedContact ? (
            /* ── Revealed contact card ── */
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50 px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-medium text-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Contact revealed
                </span>
              </div>

              {[
                { icon: <Phone className="h-4 w-4 text-gray-500" />, label: 'Phone', value: revealedContact.buyerPhoneNumber },
                { icon: <Mail className="h-4 w-4 text-gray-500" />, label: 'Email', value: revealedContact.buyerEmail },
                { icon: <MessageCircle className="h-4 w-4 text-green-600" />, label: 'WhatsApp', value: revealedContact.buyerWhatsapp },
              ].map(({ icon, label, value }) => value && value.length > 0 ? (
                <div key={label} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm text-gray-700">
                    {icon}
                    <span className="text-gray-400 min-w-[60px]">{label}</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </span>
                  <CopyButton text={value} />
                </div>
              ) : null)}

              {revealedContact.buyerGstin && (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <span className="text-sm text-gray-700">
                    <span className="text-gray-400 mr-2">GSTIN</span>
                    <span className="font-mono font-medium text-gray-900">{revealedContact.buyerGstin}</span>
                  </span>
                  <CopyButton text={revealedContact.buyerGstin} />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onViewRevealedLeads}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View All Revealed
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* ── Confirmation prompt ── */
            <>
              <p className="text-sm text-gray-600 mb-4">
                Spend <strong>1 credit</strong> to view the buyer&apos;s contact details for this requirement.
              </p>

              {walletBalance !== null && (
                <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
                  walletBalance < 1
                    ? 'bg-red-50 text-red-700'
                    : walletBalance < 5
                    ? 'bg-orange-50 text-orange-700'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  Your balance: {walletBalance} credit{walletBalance !== 1 ? 's' : ''}
                  {walletBalance < 1 && ' — Insufficient credits'}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isRevealing || (walletBalance !== null && walletBalance < 1)}
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRevealing ? 'Revealing...' : 'Confirm (1 Credit)'}
                </button>
              </div>

              {walletBalance !== null && walletBalance < 1 && (
                <p className="mt-3 text-center text-xs text-gray-500">
                  <a href="/seller/wallet/recharge" className="text-primary hover:underline font-medium">
                    Recharge your wallet →
                  </a>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
