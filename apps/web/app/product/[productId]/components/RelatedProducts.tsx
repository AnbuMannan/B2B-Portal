import Link from 'next/link';
import Image from 'next/image';

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
}

interface Props {
  products: RelatedProduct[];
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RelatedProducts({ products }: Props) {
  if (!products || products.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Related Products</h2>

      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0 snap-x snap-mandatory">
        {products.map((product) => {
          const lowestTier =
            product.pricingTiers.length > 0
              ? product.pricingTiers.reduce((prev, curr) =>
                  curr.price < prev.price ? curr : prev,
                )
              : null;

          return (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="group flex-shrink-0 w-48 lg:w-auto snap-start bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all overflow-hidden"
            >
              {/* Product image */}
              <div className="relative aspect-square bg-gray-50 overflow-hidden">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 192px, 20vw"
                    className="object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-3">
                <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">
                  {product.name}
                </p>
                <p className="text-xs text-gray-500 mt-1 truncate">{product.sellerCompanyName}</p>

                {/* Verified badge */}
                {product.isVerified && (
                  <span className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                    ✓ Verified
                  </span>
                )}

                {/* Price */}
                {lowestTier && (
                  <p className="mt-2 text-sm font-semibold text-blue-700">
                    {formatINR(lowestTier.price)}
                    <span className="text-xs font-normal text-gray-400"> onwards</span>
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
