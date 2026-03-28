'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/homepage/Header';
import Footer from '@/components/homepage/Footer';
import ProductGrid from '@/components/products/ProductGrid';
import ProductFilters from '@/components/filters/ProductFilters';

interface Category {
  id: string;
  name: string;
  parentId?: string;
  children?: Category[];
  productCount: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  image: string;
  sellerCompanyName: string;
  sellerType: string;
  isVerified: boolean;
  pricingTiers: Array<{
    tier: string;
    price: number;
    moq: number;
  }>;
  sellerState: string;
  verificationBadges: string[];
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    offset: number;
  };
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

interface FilterState {
  priceMin?: number;
  priceMax?: number;
  state?: string;
  sellerTypes?: string[];
  verificationBadges?: string[];
  verifiedOnly?: boolean;
  iecGlobal?: boolean;
}

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.categoryId as string;

  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('relevance');
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Category[]>([]);

  // Fetch category details and breadcrumb
  const { data: categoryData } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      const response = await fetch(`/api/categories/${categoryId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch category');
      }
      const result: ApiResponse<Category> = await response.json();
      return result.data;
    },
    enabled: !!categoryId,
  });

  // Fetch category breadcrumb
  const { data: breadcrumbData } = useQuery({
    queryKey: ['category-breadcrumb', categoryId],
    queryFn: async () => {
      const response = await fetch(`/api/categories/${categoryId}/breadcrumb`);
      if (!response.ok) {
        return [];
      }
      const result: ApiResponse<Category[]> = await response.json();
      return result.data || [];
    },
    enabled: !!categoryId,
  });

  // Fetch products with filters and pagination
  const {
    data: productsData,
    isLoading: isLoadingProducts,
    isError,
    error,
  } = useQuery({
    queryKey: ['category-products', categoryId, currentPage, sortBy, filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        sortBy,
        ...(filters.priceMin && { priceMin: filters.priceMin.toString() }),
        ...(filters.priceMax && { priceMax: filters.priceMax.toString() }),
        ...(filters.state && { state: filters.state }),
        ...(filters.verifiedOnly && { verifiedOnly: 'true' }),
        ...(filters.iecGlobal && { iecGlobal: 'true' }),
      });

      if (filters.sellerTypes?.length) {
        filters.sellerTypes.forEach(type => {
          queryParams.append('sellerTypes', type);
        });
      }

      if (filters.verificationBadges?.length) {
        filters.verificationBadges.forEach(badge => {
          queryParams.append('verificationBadges', badge);
        });
      }

      const response = await fetch(`/api/categories/${categoryId}/products?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const result: ApiResponse<PaginatedResponse<Product>> = await response.json();
      return result.data;
    },
    enabled: !!categoryId,
    placeholderData: (previousData) => previousData,
  });

  // Fetch sibling categories
  const { data: siblingCategories = [] } = useQuery({
    queryKey: ['category-siblings', selectedCategory?.parentId],
    queryFn: async () => {
      if (!selectedCategory?.parentId) return [];
      const response = await fetch(`/api/categories/${selectedCategory.parentId}/children`);
      if (!response.ok) return [];
      const result: ApiResponse<Category[]> = await response.json();
      return result.data || [];
    },
    enabled: !!selectedCategory?.parentId,
  });

  useEffect(() => {
    if (categoryData) {
      setSelectedCategory(categoryData);
    }
  }, [categoryData]);

  useEffect(() => {
    if (breadcrumbData) {
      setBreadcrumb(breadcrumbData);
    }
  }, [breadcrumbData]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductClick = (productId: string) => {
    // Track product view
    fetch(`/api/products/${productId}/view`, { method: 'POST' }).catch(() => {
      // Silent fail for analytics
    });
  };

  const products = productsData?.data || [];
  const pagination = productsData?.pagination;
  const totalPages = pagination?.pages || 1;
  const totalProducts = pagination?.total || 0;

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Category</h2>
            <p className="text-gray-600 mb-8">{(error as Error)?.message || 'Failed to load category products'}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go Back Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <button
            onClick={() => router.push('/')}
            className="hover:text-blue-600 transition-colors"
          >
            Home
          </button>
          {breadcrumb.map((category, index) => (
            <span key={category.id} className="flex items-center">
              <span className="mx-2">/</span>
              {index === breadcrumb.length - 1 ? (
                <span className="text-gray-900 font-medium">{category.name}</span>
              ) : (
                <button
                  onClick={() => router.push(`/category/${category.id}`)}
                  className="hover:text-blue-600 transition-colors"
                >
                  {category.name}
                </button>
              )}
            </span>
          ))}
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters - Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <ProductFilters 
                filters={filters} 
                onFiltersChange={setFilters}
                isLoading={isLoadingProducts}
              />
              
              {siblingCategories.length > 0 && (
                <div className="mt-8 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4">Related Categories</h3>
                  <div className="space-y-2">
                    {siblingCategories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => router.push(`/category/${category.id}`)}
                        className={`block text-sm text-left w-full px-2 py-1 rounded transition-colors ${
                          category.id === categoryId 
                            ? 'bg-blue-50 text-blue-700 font-medium' 
                            : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {/* Sorting & Stats */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedCategory?.name || 'Category'}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({totalProducts} products)
                </span>
              </h1>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select 
                  className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>

            <ProductGrid 
              products={products}
              isLoading={isLoadingProducts}
              onProductClick={handleProductClick}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <nav className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoadingProducts}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      // Simple pagination logic for demo
                      let pageNum = i + 1;
                      if (currentPage > 3 && totalPages > 5) {
                        pageNum = currentPage - 2 + i;
                        if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          disabled={isLoadingProducts}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || isLoadingProducts}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}