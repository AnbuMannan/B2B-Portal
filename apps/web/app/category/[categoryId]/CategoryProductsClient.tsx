'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ProductFilters from '@/components/filters/ProductFilters'
import ProductGrid from '@/components/products/ProductGrid'

interface FilterState {
  priceMin?: number
  priceMax?: number
  state?: string
  sellerTypes?: string[]
  verificationBadges?: string[]
  verifiedOnly?: boolean
  iecGlobal?: boolean
}

export default function CategoryProductsClient({ categoryId }: { categoryId: string; categoryName: string }) {
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('relevance')
  const [filters, setFilters] = useState<FilterState>({})

  const { data, isLoading } = useQuery({
    queryKey: ['category-products', categoryId, page, sortBy, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20', sortBy })
      if (filters.priceMin) params.set('priceMin', String(filters.priceMin))
      if (filters.priceMax) params.set('priceMax', String(filters.priceMax))
      if (filters.state) params.set('state', filters.state)
      if (filters.verifiedOnly) params.set('verifiedOnly', 'true')
      if (filters.iecGlobal) params.set('iecGlobal', 'true')
      filters.sellerTypes?.forEach(t => params.append('sellerTypes', t))
      filters.verificationBadges?.forEach(b => params.append('verificationBadges', b))
      const res = await fetch(`/api/categories/${categoryId}/products?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      return json.data
    },
    placeholderData: prev => prev,
  })

  const products = data?.data ?? []
  const totalPages = data?.pagination?.pages ?? 1

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <aside className="w-full lg:w-64 flex-shrink-0">
        <div className="sticky top-24">
          <ProductFilters filters={filters} onFiltersChange={f => { setFilters(f); setPage(1) }} isLoading={isLoading} />
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex justify-end mb-4">
          <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
            <option value="relevance">Relevance</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
        <ProductGrid products={products} isLoading={isLoading} />
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50">Previous</button>
            <span className="px-4 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}
