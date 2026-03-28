'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Lock } from 'lucide-react';
import Link from 'next/link';

interface ContactGateProps {
  sellerName: string;
}

export default function ContactGate({ sellerName }: ContactGateProps) {
  const { status } = useSession();
  const [product, setProduct] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (status === 'loading') {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm animate-pulse">
        <div className="h-8 w-8 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="h-5 w-3/4 bg-gray-200 rounded mx-auto mb-3" />
        <div className="h-4 w-full bg-gray-200 rounded mb-4" />
        <div className="h-10 w-full bg-gray-200 rounded" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="flex flex-col items-center text-center gap-3">
          <Lock className="text-gray-400" size={32} />
          <h3 className="text-lg font-semibold text-gray-900">
            Contact {sellerName}
          </h3>
          <p className="text-sm text-gray-500">
            Register free to view phone, email and WhatsApp details
          </p>
          <Link
            href="/auth/signup"
            className="w-full mt-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors text-center block"
          >
            Register Free
          </Link>
          <p className="text-xs text-gray-500">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-blue-600 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Enquiry</h3>

      {submitted ? (
        <div className="text-center py-4">
          <div className="text-green-600 text-3xl mb-2">✓</div>
          <p className="text-sm text-gray-700 font-medium">
            Enquiry sent! The seller will contact you soon.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="space-y-3"
        >
          <input
            type="text"
            placeholder="What product are you looking for?"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            rows={3}
            placeholder="Additional message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Send Enquiry
          </button>
        </form>
      )}

      <p className="mt-3 text-xs text-gray-500 text-center">
        🔒 Your contact details are never shared publicly
      </p>
    </div>
  );
}
