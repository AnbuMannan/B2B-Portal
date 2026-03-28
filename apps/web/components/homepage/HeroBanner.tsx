'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Search } from 'lucide-react'

type SearchType = 'products' | 'suppliers' | 'buy-leads'

const options: { label: string; value: SearchType }[] = [
  { label: 'Products', value: 'products' },
  { label: 'Suppliers', value: 'suppliers' },
  { label: 'Buy Leads', value: 'buy-leads' },
]

const HeroBanner = () => {
  const [searchType, setSearchType] = useState<SearchType>('products')
  const [query, setQuery] = useState('')

  const placeholderMap: Record<SearchType, string> = {
    products: 'Search for products, SKUs, or categories',
    suppliers: 'Search for verified suppliers, manufacturers, or exporters',
    'buy-leads': 'Search active buy leads by product or location',
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-900 text-white">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-blue-400 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 h-80 w-80 rounded-full bg-indigo-500 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 md:py-20 lg:px-8 lg:py-24">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          Find Trusted B2B Partners Across India
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-blue-100">
          Discover verified GST, IEC, MSME sellers and active buyers for your business growth.
        </p>

        <div className="mt-8 w-full max-w-3xl rounded-2xl bg-white/10 p-2 shadow-xl ring-1 ring-white/20 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center rounded-xl bg-white/90 px-3 py-2 text-sm text-gray-900 sm:w-40">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as SearchType)}
                className="w-full bg-transparent text-sm font-medium text-gray-900 outline-none"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 items-center rounded-xl bg-white/90 px-3 py-2 text-gray-900">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder={placeholderMap[searchType]}
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-blue-100">
          <span className="rounded-full bg-white/10 px-3 py-1">50K+ verified sellers</span>
          <span className="rounded-full bg-white/10 px-3 py-1">100K+ products listed</span>
          <span className="rounded-full bg-white/10 px-3 py-1">Pan-India logistics support</span>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/seller/signup"
            className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-md transition hover:bg-gray-100"
          >
            Start Selling
          </Link>
          <Link
            href="/post-requirement"
            className="rounded-lg border border-white/70 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Post Your Requirement
          </Link>
        </div>
      </div>
    </section>
  )
}

export default HeroBanner
