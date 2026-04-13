'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageCircle, Mail, Send, Globe, CheckCircle2,
  RefreshCw, Bookmark, BookmarkCheck, Sparkles,
} from 'lucide-react';
import type { BuyLead } from '../BuyLeadsClient';

interface LeadCardProps {
  lead: BuyLead;
  isRevealed: boolean;
  isMatched?: boolean;
  isSaved?: boolean;
  onReveal: () => void;
  onToggleSave?: () => void;
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
  India: '🇮🇳', UAE: '🇦🇪', USA: '🇺🇸', UK: '🇬🇧',
  'Saudi Arabia': '🇸🇦', Singapore: '🇸🇬', Australia: '🇦🇺',
  Canada: '🇨🇦', Germany: '🇩🇪', China: '🇨🇳',
};

function flag(country: string) {
  return COUNTRY_FLAG[country] ?? '🌍';
}

/**
 * Real-time countdown string updated every minute.
 * Returns a string like "1d 4h" or "3h 22m" or "Expired".
 */
function useCountdown(expiryDate: string | null): { label: string; urgent: boolean } {
  const compute = () => {
    if (!expiryDate) return { label: '', urgent: false };
    const ms = new Date(expiryDate).getTime() - Date.now();
    if (ms <= 0) return { label: 'Expired', urgent: true };
    const totalMinutes = Math.floor(ms / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const mins = totalMinutes % 60;
    const urgent = ms < 2 * 24 * 60 * 60 * 1000; // < 2 days
    if (days > 0) return { label: `${days}d ${hours}h left`, urgent };
    if (hours > 0) return { label: `${hours}h ${mins}m left`, urgent };
    return { label: `${mins}m left`, urgent: true };
  };

  const [state, setState] = useState(compute);

  useEffect(() => {
    if (!expiryDate) return;
    const id = setInterval(() => setState(compute()), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiryDate]);

  return state;
}

export function LeadCard({ lead, isRevealed, isMatched, isSaved, onReveal, onToggleSave }: LeadCardProps) {
  const { label: countdownLabel, urgent } = useCountdown(lead.expiryDate);
  const postedAgo = formatDistanceToNow(new Date(lead.postedAt), { addSuffix: true });

  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm ring-1 transition-shadow hover:shadow-md ${
        isMatched ? 'ring-primary/40 shadow-primary/5' : 'ring-gray-200'
      }`}
    >
      {/* Bookmark toggle */}
      {onToggleSave && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          className="absolute right-4 top-4 text-gray-400 hover:text-primary transition-colors"
          title={isSaved ? 'Remove from watchlist' : 'Save to watchlist'}
        >
          {isSaved
            ? <BookmarkCheck className="h-5 w-5 text-primary" />
            : <Bookmark className="h-5 w-5" />
          }
        </button>
      )}

      <div>
        {/* Matched badge */}
        {isMatched && (
          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Matches your products
          </div>
        )}

        {/* Title row */}
        <div className="flex items-start justify-between gap-2 pr-6">
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

        {/* Quantity */}
        {(lead.quantity != null || lead.unit) && (
          <p className="mt-1 text-sm text-gray-600">
            Qty:{' '}
            <span className="font-medium">
              {lead.quantity != null ? lead.quantity : '—'} {lead.unit ?? ''}
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

        {/* Live countdown */}
        {countdownLabel && (
          <p className={`mt-1.5 text-xs font-medium ${urgent ? 'text-red-600' : 'text-gray-400'}`}>
            {countdownLabel}
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
