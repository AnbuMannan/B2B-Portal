'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';

interface PricingTier {
  price?: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CatalogueProduct {
  id: string;
  name: string;
  images: string[] | null;
  multiTierPricing: Record<string, PricingTier> | null;
  categoryName: string;
}

interface SellerProductsProps {
  sellerId: string;
}

function getMinPrice(multiTierPricing: Record<string, PricingTier> | null): number | null {
  if (!multiTierPricing || typeof multiTierPricing !== 'object') return null;
  const tiers = Object.values(multiTierPricing);
  const prices = tiers
    .map((t) => t?.price)
    .filter((p): p is number => typeof p === 'number' && p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function getFirstImage(images: string[] | null): string | null {
  if (!images) return null;
  if (Array.isArray(images) && images.length > 0) return images[0];
  return null;
}

function ProductImagePlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

function ProductCard({ product }: { product: CatalogueProduct }) {
  const [imgError, setImgError] = useState(false);
  const imageSrc = getFirstImage(product.images);
  const minPrice = getMinPrice(product.multiTierPricing);

  return (
    <Link href={`/product/${product.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group">
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          {imageSrc && !imgError ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              className="object-contain group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <ProductImagePlaceholder />
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {product.name}
          </p>
          {product.categoryName && (
            <p className="text-xs text-gray-500 mt-1">{product.categoryName}</p>
          )}
          <p className="text-sm font-medium text-blue-700 mt-2">
            {minPrice !== null
              ? `From ₹${minPrice.toLocaleString('en-IN')}`
              : 'Price on request'}
          </p>
          <div className="mt-2 w-full text-xs text-center py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
            View Details
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SellerProducts({ sellerId }: SellerProductsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [allProducts, setAllProducts] = useState<CatalogueProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['seller-products', sellerId, currentPage],
    queryFn: async () => {
      const res = await fetch(
        `/api/sellers/${sellerId}/products?page=${currentPage}&limit=12`,
      );
      if (!res.ok) throw new Error('Failed to fetch products');
      const json = await res.json();
      return json.data as { data: CatalogueProduct[]; pagination: Pagination };
    },
    enabled: !!sellerId,
  });

  useEffect(() => {
    if (!data) return;
    if (currentPage === 1) {
      setAllProducts(data.data);
    } else {
      setAllProducts((prev) => [...prev, ...data.data]);
    }
  }, [data, currentPage]);

  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const categories = ['All', ...Array.from(new Set(allProducts.map((p) => p.categoryName).filter(Boolean)))];

  const filtered = selectedCategory === 'All'
    ? allProducts
    : allProducts.filter((p) => p.categoryName === selectedCategory);

  if (isLoading && allProducts.length === 0) {
    return (
      <div>
        <div className="h-9 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-t-lg" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isLoading && allProducts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p>No products listed yet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Category filter */}
      {categories.length > 2 && (
        <div className="mb-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Load More */}
      {currentPage < totalPages && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={isFetching}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {isFetching ? 'Loading...' : 'Load More Products'}
          </button>
        </div>
      )}
    </div>
  );
}
