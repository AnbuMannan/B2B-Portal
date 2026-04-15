'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const PLACEHOLDER_STYLE = 'w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200';

function getTierLabel(tierKey: string): string {
  const map: Record<string, string> = {
    tier1: 'Retail',     tier2: 'Wholesale',     tier3: 'Bulk',
    TIER1: 'Retail',     TIER2: 'Wholesale',     TIER3: 'Bulk',
    retail: 'Retail',    wholesale: 'Wholesale', bulk: 'Bulk',
    RETAIL: 'Retail',    WHOLESALE: 'Wholesale', BULK: 'Bulk',
  };
  return map[tierKey] ?? (tierKey.charAt(0).toUpperCase() + tierKey.slice(1).toLowerCase());
}

interface PricingTier {
  tier: string;
  price: number;
  moq: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  image: string;
  sellerCompanyName: string;
  sellerType: string;
  isVerified: boolean;
  pricingTiers: PricingTier[];
  sellerState: string;
  verificationBadges: string[];
  createdAt: string;
}

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  onProductClick?: (productId: string) => void;
}

function ProductCard({ product, onProductClick }: { product: Product; onProductClick?: (id: string) => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 group">
      <Link href={`/product/${product.id}`} onClick={() => onProductClick?.(product.id)}>
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          {!imgError && product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={PLACEHOLDER_STYLE}>
              <span className="text-4xl">📦</span>
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {product.verificationBadges.slice(0, 2).map((badge, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {product.name}
          </h3>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{product.sellerCompanyName}</span>
            {product.isVerified && (
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Verified
              </span>
            )}
          </div>

          <div className="space-y-2">
            {product.pricingTiers.map((tier, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{getTierLabel(tier.tier)}:</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    ₹{tier.price.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-gray-500">MOQ: {tier.moq}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-500">{product.sellerState}</span>
            <span className="text-xs text-gray-500">
              {new Date(product.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Hover overlay with CTAs */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white text-gray-900 rounded-md font-medium hover:bg-gray-50 transition-colors">
              View Details
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors">
              Get Quote
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}

const ProductGrid = ({ products, isLoading = false, onProductClick }: ProductGridProps) => {
  const [visibleProducts, setVisibleProducts] = useState<number>(8);
  const observerRef = useRef<IntersectionObserver | undefined>(undefined);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) return;

    const options = {
      root: null,
      rootMargin: '200px',
      threshold: 0.1,
    };

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && visibleProducts < products.length) {
          setVisibleProducts((prev) => Math.min(prev + 8, products.length));
        }
      });
    };

    observerRef.current = new IntersectionObserver(handleIntersect, options);

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isLoading, products.length, visibleProducts]);

  const displayedProducts = products.slice(0, visibleProducts);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
            <div className="h-48 bg-gray-200"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">🔍</div>
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No products found</h3>
        <p className="text-gray-500">Try adjusting your filters or search criteria</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayedProducts.map((product) => (
          <ProductCard key={product.id} product={product} onProductClick={onProductClick} />
        ))}
      </div>

      {/* Load more trigger */}
      {visibleProducts < products.length && (
        <div ref={loadMoreRef} className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Mobile single column indicator */}
      <div className="md:hidden text-center text-sm text-gray-500">
        Showing {displayedProducts.length} of {products.length} products
      </div>
    </div>
  );
};

export default ProductGrid;