'use client'

import { useQuery } from '@tanstack/react-query'
import { Package, MapPin, ShoppingCart } from 'lucide-react'
import Link from 'next/link'

interface BuyLead {
  productName: string
  quantity: string
  country: string
  flag: string
}

interface LatestBuyLeadsPayload {
  leads: BuyLead[]
}

interface LatestBuyLeadsApiResponse {
  success: boolean
  data?: LatestBuyLeadsPayload
}

export function LatestBuyLeads() {
  const { data, isLoading } = useQuery<LatestBuyLeadsApiResponse>({
    queryKey: ['homepage', 'latest-buy-leads'],
    queryFn: async () => {
      const res = await fetch('/api/homepage/latest-buy-leads', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch latest buy leads')
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    throwOnError: false,
    retry: 1,
  })

  const leads = data?.data?.leads || []

  return (
    <section className="bg-gray-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Latest Buy Leads
          </h2>
          <p className="mt-2 text-lg text-gray-600">
            Active buyer requirements from verified procurement managers across India
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-6 animate-pulse"
                >
                  <div className="mb-4 h-6 w-3/4 rounded bg-gray-200" />
                  <div className="mb-3 h-4 w-full rounded bg-gray-200" />
                  <div className="mb-4 h-4 w-2/3 rounded bg-gray-200" />
                </div>
              ))
            : leads.length > 0
            ? leads.map((lead, index) => (
                <article
                  key={`${lead.productName}-${index}`}
                  className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:border-blue-300 hover:shadow-lg"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <h3 className="flex-1 text-base font-semibold leading-snug text-gray-900">
                      {lead.productName}
                    </h3>
                    <span className="ml-2 whitespace-nowrap rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      Open Lead
                    </span>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <ShoppingCart className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span>
                        <span className="font-medium text-gray-800">Required:</span>{' '}
                        {lead.quantity}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span>
                        {lead.flag} {lead.country}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                    <span className="text-xs text-gray-400">Posted recently</span>
                    <Link
                      href="/buy-leads"
                      className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
                    >
                      Contact Buyer →
                    </Link>
                  </div>
                </article>
              ))
            : (
              <div className="col-span-full py-12 text-center">
                <Package className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <p className="text-gray-500">No buy leads available</p>
              </div>
            )}
        </div>

        {leads.length > 0 && (
          <div className="mt-12 text-center">
            <Link href="/buy-leads">
              <button className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-blue-700">
                View All Buy Leads →
              </button>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
