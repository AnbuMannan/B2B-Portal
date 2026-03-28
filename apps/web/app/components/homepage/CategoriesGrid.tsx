'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Package, Cpu, Hammer, Shirt, Home, Truck, Tractor, Box, FlaskConical, Car, Building2 } from 'lucide-react'

interface Category {
  id: string
  name: string
  description: string | null
  industryType: string[]
  children?: Category[]
}

interface CategoriesPayload {
  categories: Category[]
}

interface CategoriesApiResponse {
  success: boolean
  data?: CategoriesPayload
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Electronics & IT': <Cpu className="h-6 w-6" />,
  'Machinery & Equipment': <Hammer className="h-6 w-6" />,
  'Textiles & Apparel': <Shirt className="h-6 w-6" />,
  'Home & Furniture': <Home className="h-6 w-6" />,
  'Agriculture & Food': <Tractor className="h-6 w-6" />,
  'Chemicals & Pharmaceuticals': <FlaskConical className="h-6 w-6" />,
  Automotive: <Car className="h-6 w-6" />,
  'Construction Materials': <Building2 className="h-6 w-6" />,
  Electronics: <Cpu className="h-6 w-6" />,
  Machinery: <Hammer className="h-6 w-6" />,
  Textiles: <Shirt className="h-6 w-6" />,
  Agriculture: <Tractor className="h-6 w-6" />,
  Logistics: <Truck className="h-6 w-6" />,
  Packaging: <Box className="h-6 w-6" />,
  Chemicals: <FlaskConical className="h-6 w-6" />,
  Default: <Package className="h-6 w-6" />,
}

function getCategoryIcon(name: string): React.ReactNode {
  if (CATEGORY_ICONS[name]) return CATEGORY_ICONS[name]
  for (const key of Object.keys(CATEGORY_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return CATEGORY_ICONS[key]
    }
  }
  return CATEGORY_ICONS.Default
}

export function CategoriesGrid() {
  const { data, isLoading } = useQuery<CategoriesApiResponse>({
    queryKey: ['homepage', 'categories'],
    queryFn: async () => {
      const res = await fetch('/api/homepage/categories', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch categories')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
    retry: 1,
  })

  const categories = data?.data?.categories || []

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 text-foreground sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Browse Categories</h2>
          <p className="text-md text-muted-foreground">
            Find verified sellers and quality products across multiple categories
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-6 lg:gap-6">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex h-full flex-col items-center justify-center rounded-lg bg-card p-4 ring-1 ring-border animate-pulse"
              >
                <div className="mb-3 h-10 w-10 rounded-full bg-muted" />
                <div className="mb-2 h-4 w-24 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
            ))
          : categories.length > 0
          ? categories.map((category) => {
              const icon = getCategoryIcon(category.name)
              const industryTags = category.industryType?.slice(0, 1) || []
              const childCount = category.children?.length || 0

              return (
                <Link key={category.id} href={`/category/${category.id}`}>
                  <article className="group flex h-full cursor-pointer flex-col items-center justify-center rounded-lg bg-card p-4 text-center ring-1 ring-border transition-transform transition-shadow hover:-translate-y-1 hover:scale-105 hover:shadow-lg focus-within:outline-none">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary">
                      {icon}
                    </div>
                    <h3 className="mb-1 text-sm font-semibold leading-tight">
                      {category.name}
                    </h3>
                    {industryTags.length > 0 && (
                      <p className="mb-1 text-xs text-muted-foreground">
                        {industryTags[0]}
                      </p>
                    )}
                    <div className="mt-1 inline-flex rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-primary">
                      {childCount > 0 ? `${childCount} subcategories` : 'View Products'}
                    </div>
                  </article>
                </Link>
              )
            })
          : (
            <div className="col-span-full py-12 text-center">
              <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No categories available</p>
            </div>
          )}
      </div>
    </section>
  )
}
