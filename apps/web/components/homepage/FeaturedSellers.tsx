'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

interface SellerBadge {
  type: string
  label: string
}

interface FeaturedSeller {
  id: string
  companyName: string
  logoUrl?: string
  badges: SellerBadge[]
  productCount: number
  yearsInBusiness: number
  city?: string
  state?: string
}

interface FeaturedSellersPayload {
  sellers: FeaturedSeller[]
}

interface FeaturedSellersApiResponse {
  success: boolean
  data?: FeaturedSellersPayload
}

const fallbackSellers: FeaturedSeller[] = [
  {
    id: '1',
    companyName: 'TechCorp India',
    badges: [
      { type: 'GST_VERIFIED', label: 'GST Verified' },
      { type: 'MSME_REGISTERED', label: 'MSME Registered' },
    ],
    productCount: 42,
    yearsInBusiness: 5,
    city: 'Bengaluru',
    state: 'Karnataka',
  },
  {
    id: '2',
    companyName: 'Global Exports Ltd',
    badges: [
      { type: 'IEC_GLOBAL', label: 'IEC Global' },
      { type: 'GST_VERIFIED', label: 'GST Verified' },
    ],
    productCount: 28,
    yearsInBusiness: 8,
    city: 'Mumbai',
    state: 'Maharashtra',
  },
  {
    id: '3',
    companyName: 'Prime Manufacturing',
    badges: [
      { type: 'MSME_REGISTERED', label: 'MSME Registered' },
      { type: 'GST_VERIFIED', label: 'GST Verified' },
    ],
    productCount: 35,
    yearsInBusiness: 3,
    city: 'Delhi',
    state: 'Delhi',
  },
  {
    id: '4',
    companyName: 'Quality Products Inc',
    badges: [
      { type: 'GST_VERIFIED', label: 'GST Verified' },
      { type: 'IEC_GLOBAL', label: 'IEC Global' },
    ],
    productCount: 19,
    yearsInBusiness: 6,
    city: 'Chennai',
    state: 'Tamil Nadu',
  },
]

const getBadgeColor = (type: string) => {
  switch (type) {
    case 'GST_VERIFIED':
      return 'bg-green-100 text-green-800'
    case 'IEC_GLOBAL':
      return 'bg-blue-100 text-blue-800'
    case 'MSME_REGISTERED':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const FeaturedSellers = () => {
  const { data, isLoading, error } = useQuery<FeaturedSellersApiResponse>({
    queryKey: ['homepage', 'featured-sellers'],
    queryFn: async () => {
      const response = await fetch('/api/homepage/featured-sellers', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch featured sellers')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const sellers = data?.data?.sellers && data.data.sellers.length > 0 ? data.data.sellers : fallbackSellers

  if (error) {
    return (
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 text-center text-red-600 sm:px-6 lg:px-8">
          Failed to load featured sellers
        </div>
      </section>
    )
  }

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Featured Sellers</h2>
          <p className="mt-2 text-gray-600">
            Verified sellers with strong trade histories and reliable fulfillment records
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-sm animate-pulse"
                >
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-200" />
                  <div className="mx-auto mb-3 h-5 w-32 bg-gray-200" />
                  <div className="mx-auto mb-4 h-4 w-40 bg-gray-200" />
                  <div className="mb-4 flex justify-between text-sm text-gray-400">
                    <div className="h-4 w-16 bg-gray-200" />
                    <div className="h-4 w-16 bg-gray-200" />
                  </div>
                  <div className="mt-auto h-9 w-full bg-gray-200" />
                </div>
              ))
            : sellers.map((seller) => (
                <article
                  key={seller.id}
                  className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                      <span className="text-2xl font-bold text-blue-600">
                        {seller.companyName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <h3 className="mb-2 text-center text-xl font-semibold text-gray-800">{seller.companyName}</h3>

                  <div className="mb-3 text-center text-sm text-gray-500">
                    {seller.city || seller.state ? `${seller.city || ''}${seller.city && seller.state ? ', ' : ''}${seller.state || ''}` : 'Location on request'}
                  </div>

                  <div className="mb-4 flex items-center justify-center gap-1 text-yellow-400" aria-label="Rating">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span key={index}>★</span>
                    ))}
                  </div>

                  <div className="mb-4 flex justify-between text-sm text-gray-600">
                    <span>{seller.productCount} products</span>
                    <span>{seller.yearsInBusiness}+ years</span>
                  </div>

                  <div className="mb-4 flex flex-wrap justify-center gap-2">
                    {seller.badges.map((badge) => (
                      <span
                        key={badge.type + badge.label}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getBadgeColor(badge.type)}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  <Link
                    href={`/seller/${seller.id}`}
                    className="mt-auto block rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    View All Products
                  </Link>
                </article>
              ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/sellers"
            className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View All Verified Sellers →
          </Link>
        </div>
      </div>
    </section>
  )
}

export default FeaturedSellers