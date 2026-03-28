'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Package, Users, TrendingUp, Search } from 'lucide-react'
import Link from 'next/link'

type SearchType = 'products' | 'suppliers' | 'buy-leads'

interface TrustMetric {
  label: string
  value: string
}

interface HeroDataResponse {
  success: boolean
  data?: {
    trustMetrics?: TrustMetric[]
  }
}

const searchOptions: { label: string; value: SearchType }[] = [
  { label: 'Products', value: 'products' },
  { label: 'Suppliers', value: 'suppliers' },
  { label: 'Buy Leads', value: 'buy-leads' },
]

const fallbackTrustMetrics: TrustMetric[] = [
  { label: 'Verified Sellers', value: '50K+' },
  { label: 'Products Listed', value: '100K+' },
  { label: 'MSME Registered', value: '15K+' },
  { label: 'IEC Global Traders', value: '5K+' },
]

export function HeroSection() {
  const router = useRouter()
  const [searchType, setSearchType] = useState<SearchType>('products')
  const [query, setQuery] = useState('')

  const { data } = useQuery<HeroDataResponse>({
    queryKey: ['homepage', 'hero-data'],
    queryFn: async () => {
      const res = await fetch('/api/homepage/hero-data', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch hero data')
      }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const trustMetrics = data?.data?.trustMetrics && data.data.trustMetrics.length > 0
    ? data.data.trustMetrics
    : fallbackTrustMetrics

  const placeholderMap: Record<SearchType, string> = {
    products: 'Search for products, SKUs, or categories',
    suppliers: 'Search for verified suppliers, manufacturers, or exporters',
    'buy-leads': 'Search active buy leads by product or location',
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    const url = trimmed ? `/search?type=${searchType}&q=${encodeURIComponent(trimmed)}` : `/search?type=${searchType}`
    router.push(url)
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-900 text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-400 opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-400 opacity-20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Connect with B2B Sellers Across India
              </h1>
              <p className="text-lg text-blue-100">
                Verified GST, IEC, MSME sellers. Find trusted suppliers and grow your business on India&apos;s leading B2B marketplace.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              className="mt-4 rounded-2xl bg-white/10 p-2 shadow-xl ring-1 ring-white/20 backdrop-blur"
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex items-center rounded-xl bg-white/90 px-3 py-2 text-sm text-gray-900 sm:w-40">
                  <select
                    aria-label="Select search type"
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value as SearchType)}
                    className="w-full bg-transparent text-sm font-medium text-gray-900 outline-none"
                  >
                    {searchOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-1 items-center rounded-xl bg-white/90 px-3 py-2 text-gray-900">
                  <input
                    aria-label="Search query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    type="text"
                    placeholder={placeholderMap[searchType]}
                    className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700 focus-visible:ring-white"
                >
                  <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                  Search
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-3 text-sm text-blue-100">
              <span className="rounded-full bg-white/10 px-3 py-1">50K+ verified sellers</span>
              <span className="rounded-full bg-white/10 px-3 py-1">100K+ products</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Pan-India logistics</span>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/browse-categories">
                <button className="rounded-lg bg-white px-8 py-4 text-base font-semibold text-blue-600 shadow-lg transition hover:bg-blue-50">
                  Browse Products
                </button>
              </Link>
              <Link href="/post-requirement">
                <button className="rounded-lg border-2 border-white px-8 py-4 text-base font-semibold text-white transition hover:bg-white/10">
                  Post Your Requirement
                </button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-8 text-sm sm:grid-cols-4">
              {trustMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
                >
                  <div className="text-lg font-bold">{metric.value}</div>
                  <div className="text-xs text-blue-100">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden items-center justify-center md:flex">
            <div className="relative w-full max-w-md">
              <div className="h-80 w-full rounded-3xl bg-gradient-to-br from-white/20 via-white/5 to-transparent shadow-2xl ring-1 ring-white/30 backdrop-blur-md">
                <div className="absolute inset-6 rounded-2xl border border-dashed border-white/20" />
                <div className="absolute left-8 top-10 h-16 w-28 rounded-xl bg-white/10" />
                <div className="absolute right-10 top-16 h-20 w-20 rounded-full bg-white/10" />
                <div className="absolute left-16 bottom-10 h-24 w-40 rounded-2xl bg-white/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-center text-white/70">
                    <Package className="h-16 w-16 text-white/40" aria-hidden="true" />
                    <p className="max-w-xs text-sm">
                      Connected B2B businesses across India with trusted, verified trade partners.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <Users className="h-4 w-4" aria-hidden="true" />
                      <span>Real-time matchmaking between buyers and suppliers</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      <span>Enterprise-grade trade workflows and insights</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}