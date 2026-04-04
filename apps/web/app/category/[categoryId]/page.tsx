import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Header from '@/components/homepage/Header'
import Footer from '@/components/homepage/Footer'
import CategoryProductsClient from './CategoryProductsClient'
import { generateCategoryMeta } from '@/lib/seo'

export const revalidate = 3600

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001'

async function getCategory(categoryId: string) {
  try {
    const res = await fetch(`${API_URL}/api/categories/${categoryId}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch { return null }
}

async function getBreadcrumb(categoryId: string) {
  try {
    const res = await fetch(`${API_URL}/api/categories/${categoryId}/breadcrumb`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    return json.data ?? []
  } catch { return [] }
}

export async function generateMetadata({
  params,
}: {
  params: { categoryId: string }
}): Promise<Metadata> {
  const category = await getCategory(params.categoryId)
  if (!category) return { title: 'Category | B2B Portal' }
  return generateCategoryMeta({
    id: params.categoryId,
    name: category.name,
    productCount: category.productCount,
  })
}

export default async function CategoryPage({ params }: { params: { categoryId: string } }) {
  const [category, breadcrumb] = await Promise.all([
    getCategory(params.categoryId),
    getBreadcrumb(params.categoryId),
  ])

  if (!category) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <a href="/" className="hover:text-blue-600">Home</a>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {breadcrumb.map((cat: any, index: number) => (
            <span key={cat.id} className="flex items-center">
              <span className="mx-2">/</span>
              {index === breadcrumb.length - 1 ? (
                <span className="text-gray-900 font-medium">{cat.name}</span>
              ) : (
                <a href={`/category/${cat.id}`} className="hover:text-blue-600">{cat.name}</a>
              )}
            </span>
          ))}
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {category.name}
          <span className="ml-2 text-sm font-normal text-gray-500">({category.productCount} products)</span>
        </h1>

        <CategoryProductsClient categoryId={params.categoryId} categoryName={category.name} />
      </main>
      <Footer />
    </div>
  )
}
