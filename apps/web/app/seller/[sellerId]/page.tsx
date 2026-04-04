'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Header from '@/components/homepage/Header';
import Footer from '@/components/homepage/Footer';
import SellerHeader from './components/SellerHeader';
import SellerProducts from './components/SellerProducts';
import ContactGate from './components/ContactGate';

interface CatalogueItem {
  id: string;
  name: string;
  image?: string;
}

interface SellerProfile {
  id: string;
  companyName: string;
  companyType: string;
  city: string | null;
  state: string | null;
  companyInitials: string;
  badges: string[];
  yearsInBusiness: number;
  productCount: number;
  totalProductViews: number;
  industryTypes: string[];
  cataloguePreview: CatalogueItem[];
}

function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-6 mb-6 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <div className="h-7 w-28 bg-gray-200 rounded-full" />
            <div className="h-7 w-28 bg-gray-200 rounded-full" />
          </div>
          <div className="h-4 w-56 bg-gray-200 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-t-lg" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function SellerProfilePage() {
  const params = useParams();
  const sellerId = params.sellerId as string;

  const { data: seller, isLoading, isError } = useQuery<SellerProfile>({
    queryKey: ['seller-profile', sellerId],
    queryFn: async () => {
      const res = await fetch(`/api/sellers/${sellerId}/profile`);
      if (!res.ok) throw new Error('Seller not found');
      const json = await res.json();
      if (!json.success) throw new Error('Seller not found');
      return json.data as SellerProfile;
    },
    enabled: !!sellerId,
    retry: false,
  });

  if (isLoading) return <SkeletonLoader />;

  if (isError || !seller) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-6xl mb-4">🏢</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Seller not found</h2>
          <p className="text-gray-500 mb-8">
            This seller profile is not available or has been removed.
          </p>
          <Link
            href="/sellers"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Browse All Sellers
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const location = seller.city && seller.state
    ? `${seller.city}, ${seller.state}`
    : seller.state ?? seller.city ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-blue-600">Home</Link>
          <span>/</span>
          <Link href="/sellers" className="hover:text-blue-600">Sellers</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{seller.companyName}</span>
        </nav>

        {/* Header section — 2-col on desktop */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-8 items-start">
          {/* Left: Seller info */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
              <SellerHeader seller={seller} />
            </div>

            {/* About / Industry info */}
            {(seller.industryTypes.length > 0 || location) && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 mb-6">
                <h2 className="text-base font-semibold text-gray-900 mb-3">About</h2>
                <div className="space-y-2 text-sm text-gray-600">
                  {location && (
                    <p>📍 Based in <span className="font-medium">{location}</span></p>
                  )}
                  {seller.industryTypes.length > 0 && (
                    <p>
                      🏭 Industries:{' '}
                      <span className="font-medium">{seller.industryTypes.join(', ')}</span>
                    </p>
                  )}
                  {seller.totalProductViews > 0 && (
                    <p>
                      👁 <span className="font-medium">{seller.totalProductViews.toLocaleString('en-IN')}</span> total product views
                    </p>
                  )}
                  {seller.badges.includes('IEC_GLOBAL') && (
                    <p>🌏 Registered for international exports (IEC)</p>
                  )}
                </div>
              </div>
            )}

            {/* Product Catalogue */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Product Catalogue
              </h2>
              <SellerProducts sellerId={sellerId} />
            </div>
          </div>

          {/* Right: ContactGate (sticky, desktop only) */}
          <div className="hidden lg:block lg:col-span-2 mt-0">
            <div className="lg:sticky lg:top-24">
              <ContactGate sellerName={seller.companyName} />
            </div>
          </div>
        </div>

        {/* ContactGate — mobile only */}
        <div className="lg:hidden mt-6">
          <ContactGate sellerName={seller.companyName} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
