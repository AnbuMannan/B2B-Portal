'use client';

import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { MessageCircle, Mail, Send, Globe, CheckCircle2, RefreshCw } from 'lucide-react';
import type { BuyLead } from '../BuyLeadsClient';

interface LeadCardProps {
  lead: BuyLead;
  isRevealed: boolean;
  onReveal: () => void;
  accessToken?: string;
}

const CHANNEL_ICON = {
  WHATSAPP: <MessageCircle className="h-4 w-4 text-green-600" />,
  EMAIL: <Mail className="h-4 w-4 text-blue-600" />,
  TELEGRAM: <Send className="h-4 w-4 text-sky-500" />,
};

const CHANNEL_LABEL = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  TELEGRAM: 'Telegram',
};

const COUNTRY_FLAG: Record<string, string> = {
  India: '🇮🇳',
  UAE: '🇦🇪',
  USA: '🇺🇸',
  UK: '🇬🇧',
  'Saudi Arabia': '🇸🇦',
  Singapore: '🇸🇬',
  Australia: '🇦🇺',
  Canada: '🇨🇦',
  Germany: '🇩🇪',
  China: '🇨🇳',
};

function flag(country: string) {
  return COUNTRY_FLAG[country] ?? '🌍';
}

export function LeadCard({ lead, isRevealed, onReveal }: LeadCardProps) {
  const expiryDays = lead.expiryDate
    ? differenceInDays(new Date(lead.expiryDate), new Date())
    : null;
  const isExpiringSoon = expiryDays !== null && expiryDays < 2;

  const postedAgo = formatDistanceToNow(new Date(lead.postedAt), { addSuffix: true });

  return (
    <div className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md">
      {/* Top row: product name + repeat badge */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900 leading-tight">
            {lead.productName}
          </h3>
          {lead.repeatOption !== 'NONE' && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              <RefreshCw className="h-3 w-3" />
              {lead.repeatOption === 'WEEKLY' ? 'Weekly' : 'Monthly'}
            </span>
          )}
        </div>

        {/* Quantity + unit */}
        {(lead.quantity != null || lead.unit) && (
          <p className="mt-1 text-sm text-gray-600">
            Qty:{' '}
            <span className="font-medium">
              {lead.quantity != null ? lead.quantity : '—'}{' '}
              {lead.unit ?? ''}
            </span>
          </p>
        )}

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" />
            {flag(lead.expectedCountry)} {lead.expectedCountry}
          </span>
          <span className="flex items-center gap-1">
            {CHANNEL_ICON[lead.contactChannel]}
            {CHANNEL_LABEL[lead.contactChannel]}
          </span>
          <span>Posted {postedAgo}</span>
        </div>

        {/* Expiry */}
        {expiryDays !== null && (
          <p className={`mt-1.5 text-xs font-medium ${isExpiringSoon ? 'text-red-600' : 'text-gray-400'}`}>
            {expiryDays <= 0
              ? 'Expired'
              : `Expires in ${expiryDays} day${expiryDays === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-4">
        {isRevealed ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Revealed
            </span>
            <button
              onClick={onReveal}
              className="text-sm font-medium text-primary hover:underline"
            >
              View Contact
            </button>
          </div>
        ) : (
          <button
            onClick={onReveal}
            className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            Reveal Contact (1 Credit)
          </button>
        )}
      </div>
    </div>
  );
}
