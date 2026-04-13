import Link from 'next/link';

export const metadata = { title: 'KYC Submitted — B2B Bazaar', robots: 'noindex' };

export default function KycSubmittedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">Application Submitted!</h1>
        <p className="text-gray-600 mb-2">
          Your KYC application has been submitted successfully.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Our team will review your documents within <strong>2–3 business days</strong>.
          You will receive an SMS and email notification once reviewed.
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800 mb-6">
          <strong>Status:</strong> Pending Admin Review
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors"
          >
            Browse the Marketplace
          </Link>
          <Link
            href="/seller/register"
            className="block w-full border border-gray-300 text-gray-700 rounded-lg py-2.5 font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            Review My Application
          </Link>
        </div>
      </div>
    </div>
  );
}
