import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/homepage/Header';
import Footer from '@/components/homepage/Footer';
import ImageGallery from './components/ImageGallery';
import PricingTable from './components/PricingTable';
import SellerCard from './components/SellerCard';
import EnquiryModal from './components/EnquiryModal';
import RelatedProducts from './components/RelatedProducts';
import ExpandableDescription from './components/ExpandableDescription';

// ISR: re-generate this page at most once per hour
export const revalidate = 3600;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PricingTier {
  tier: string;
  price: number;
  moq: number;
}

interface RelatedProduct {
  id: string;
  name: string;
  image: string;
  sellerCompanyName: string;
  sellerType: string;
  isVerified: boolean;
  pricingTiers: PricingTier[];
  verificationBadges: string[];
  createdAt: string;
}

interface ProductDetail {
  id: string;
  name: string;
  description?: string;
  image: string;
  images: string[];
  hsnCode?: string;
  countryOfOrigin?: string;
  availabilityStatus: string;
  categories: string[];
  sellerId: string;
  sellerCompanyName: string;
  sellerType: string;
  isVerified: boolean;
  verificationBadges: string[];
  pricingTiers: PricingTier[];
  viewCount: number;
  relatedProducts: RelatedProduct[];
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

async function getProduct(productId: string): Promise<ProductDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/products/${productId}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? (json.data as ProductDetail) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadata (SEO)
// ---------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: { productId: string };
}): Promise<Metadata> {
  const product = await getProduct(params.productId);

  if (!product) {
    return { title: 'Product Not Found | B2B Portal' };
  }

  const lowestPrice =
    product.pricingTiers.length > 0
      ? Math.min(...product.pricingTiers.map((t) => t.price))
      : null;

  return {
    title: `${product.name} - Buy from ${product.sellerCompanyName} | B2B Portal`,
    description: `Buy ${product.name} at wholesale price from verified ${product.sellerCompanyName}.${lowestPrice ? ` Starting from ₹${lowestPrice.toLocaleString('en-IN')}.` : ''} GST verified B2B supplier. Get best quote now.`,
    keywords: [product.name, product.sellerCompanyName, 'wholesale', 'B2B', ...product.categories],
    openGraph: {
      title: `${product.name} | B2B Portal`,
      description: `Wholesale ${product.name} from verified B2B supplier — ${product.sellerCompanyName}`,
      type: 'website',
      images: product.images.length > 0 ? [{ url: product.images[0] }] : [],
    },
    alternates: {
      canonical: `/product/${product.id}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function ProductDetailPage({
  params,
}: {
  params: { productId: string };
}) {
  const product = await getProduct(params.productId);

  if (!product) {
    notFound();
  }

  const lowestPrice =
    product.pricingTiers.length > 0
      ? Math.min(...product.pricingTiers.map((t) => t.price))
      : null;

  // JSON-LD: Product schema
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    ...(product.hsnCode && { gtin: product.hsnCode }),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      ...(lowestPrice !== null && { lowPrice: lowestPrice }),
      offerCount: product.pricingTiers.length,
      seller: {
        '@type': 'Organization',
        name: product.sellerCompanyName,
      },
    },
  };

  // JSON-LD: BreadcrumbList schema
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
      ...product.categories.map((cat, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: cat,
      })),
      {
        '@type': 'ListItem',
        position: product.categories.length + 2,
        name: product.name,
      },
    ],
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            {product.categories.map((cat, i) => (
              <span key={i} className="flex items-center gap-1">
                <span>/</span>
                <span
                  className={
                    i === product.categories.length - 1
                      ? 'text-gray-700 font-medium'
                      : 'hover:text-blue-600 cursor-pointer'
                  }
                >
                  {cat}
                </span>
              </span>
            ))}
            <span>/</span>
            <span className="text-gray-900 font-medium truncate max-w-xs">{product.name}</span>
          </nav>

          {/* Main 2-column layout: 3/5 left + 2/5 right */}
          <div className="lg:grid lg:grid-cols-5 lg:gap-8 items-start">
            {/* ── Left column (60%) ── */}
            <div className="lg:col-span-3">
              <ImageGallery images={product.images} productName={product.name} />

              <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {product.name}
                </h1>

                {/* Meta badges */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {product.hsnCode && (
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 cursor-help"
                      title="Harmonised System Nomenclature — used for GST input tax credit"
                    >
                      HSN: {product.hsnCode}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      product.availabilityStatus === 'IN_STOCK'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {product.availabilityStatus === 'IN_STOCK' ? '● In Stock' : '● Out of Stock'}
                  </span>
                  {product.countryOfOrigin && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      Made in {product.countryOfOrigin}
                    </span>
                  )}
                  {product.viewCount > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                      👁 {product.viewCount.toLocaleString('en-IN')} views
                    </span>
                  )}
                </div>

                {/* Description */}
                {product.description && (
                  <div className="mt-5">
                    <h2 className="text-sm font-semibold text-gray-700 mb-2">
                      Product Description
                    </h2>
                    <ExpandableDescription description={product.description} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column (40%) — sticky ── */}
            <div className="lg:col-span-2 mt-6 lg:mt-0">
              <div className="lg:sticky lg:top-24 space-y-4">
                <SellerCard
                  sellerId={product.sellerId}
                  companyName={product.sellerCompanyName}
                  sellerType={product.sellerType}
                  isVerified={product.isVerified}
                  verificationBadges={product.verificationBadges}
                />
                <PricingTable tiers={product.pricingTiers} />
                <EnquiryModal
                  productId={product.id}
                  productName={product.name}
                />
              </div>
            </div>
          </div>

          {/* Related Products */}
          {product.relatedProducts && product.relatedProducts.length > 0 && (
            <RelatedProducts products={product.relatedProducts} />
          )}
        </main>

        <Footer />
      </div>

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
  );
}
