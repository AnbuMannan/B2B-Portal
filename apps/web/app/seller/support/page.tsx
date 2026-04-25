'use client';

import { useState } from 'react';
import Link from 'next/link';

const FAQS = [
  {
    q: 'How do I complete my KYC verification?',
    a: 'Go to My Profile → Register Seller and fill in your business details, upload your GST certificate, PAN card, and any other required documents. KYC review takes up to 48 business hours.',
  },
  {
    q: 'How do lead credits work?',
    a: 'Lead credits are used to reveal buyer contact details. Each contact reveal costs credits depending on the buyer\'s inquiry value. You can recharge credits from the Wallet & Credits section.',
  },
  {
    q: 'How long does product approval take?',
    a: 'Products are reviewed within 24 business hours. You\'ll receive an SMS and email notification once your product is approved or if any changes are required.',
  },
  {
    q: 'Why was my product listing rejected?',
    a: 'Common reasons include prohibited keywords, inaccurate pricing, missing product images, or incorrect category. Check the rejection reason in My Products and re-submit after corrections.',
  },
  {
    q: 'How do I respond to a buy lead?',
    a: 'Go to Buy Leads, use credits to reveal buyer contact details, then contact the buyer directly via phone or WhatsApp.',
  },
  {
    q: 'How do I update my business profile?',
    a: 'Go to My Profile to update your company description, contact details, product categories, and business hours.',
  },
  {
    q: 'What payment methods are accepted for credit recharge?',
    a: 'We accept UPI, net banking, debit cards, and credit cards via Razorpay. All payments are secured with 256-bit SSL encryption.',
  },
  {
    q: 'How do I file a complaint against a buyer?',
    a: 'Go to Complaints in the sidebar to raise a support ticket. Our team reviews all complaints within 72 hours as per Consumer Protection Rules 2020.',
  },
];

export default function SellerSupportPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Help &amp; Support</h1>
        <p className="text-sm text-gray-500 mt-1">Find answers, contact support, or raise a complaint</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/seller/complaints"
          className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Raise a Complaint</p>
            <p className="text-xs text-gray-500 mt-0.5">Report fraud, payment issues, or disputes</p>
          </div>
        </Link>

        <Link href="/seller/register"
          className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">KYC Verification</p>
            <p className="text-xs text-gray-500 mt-0.5">Complete or check your KYC status</p>
          </div>
        </Link>

        <Link href="/seller/wallet"
          className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition-colors">
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Wallet &amp; Credits</p>
            <p className="text-xs text-gray-500 mt-0.5">Recharge or check your credit balance</p>
          </div>
        </Link>
      </div>

      {/* Contact info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-blue-900 mb-3">Contact Support</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-blue-700 min-w-0">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="whitespace-nowrap">support@b2bmarket.in</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-blue-300" />
          <div className="flex items-center gap-2 text-blue-700 min-w-0">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="whitespace-nowrap">1800-XXX-XXXX &nbsp;(Mon–Sat, 9am–6pm)</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-blue-300" />
          <div className="flex items-center gap-2 text-blue-700 min-w-0">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="whitespace-nowrap">WhatsApp: +91-XXXXX-XXXXX</span>
          </div>
        </div>
        <p className="text-xs text-blue-600 mt-3">
          Average response time: 4 business hours. Complaints are resolved per Consumer Protection Rules 2020.
        </p>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Frequently Asked Questions</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800 pr-4">{faq.q}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openIdx === i ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIdx === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Still need help */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">
          Can&apos;t find what you&apos;re looking for?{' '}
          <Link href="/seller/complaints" className="text-blue-600 hover:underline font-medium">
            Raise a support ticket
          </Link>
        </p>
      </div>
    </div>
  );
}
