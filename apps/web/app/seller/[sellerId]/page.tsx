import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Header from '@/components/homepage/Header'
import Footer from '@/components/homepage/Footer'
import SellerHeader from './components/SellerHeader'
import SellerProducts from './components/SellerProducts'
import ContactGate from './components/ContactGate'
import { SellerSchema } from '@/components/seo/SellerSchema'
import { generateSellerMeta } from '@/lib/seo'

export const revalidate = 3600

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001'

async function getSeller(sellerId: string) {
  try {
    const res = await fetch(`${API_URL}/api/sellers/${sellerId}/profile`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.success ? json.data : null
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { sellerId: string }
}): Promise<Metadata> {
  const seller = await getSeller(params.sellerId)
  if (!seller) return { title: 'Seller | B2B Portal' }
  return generateSellerMeta({
    id: params.sellerId,
    companyName: seller.companyName,
    city: seller.city,
    state: seller.state,
    productCount: seller.productCount,
    industryTypes: seller.industryTypes,
  })
}

export default async function SellerProfilePage({ params }: { params: { sellerId: string } }) {
  const seller = await getSeller(params.sellerId)

  if (!seller) notFound()

  const location = seller.city && seller.state
    ? `${seller.city}, ${seller.state}`
    : seller.state ?? seller.city ?? null

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <a href="/" className="hover:text-blue-600">Home</a>
            <span>/</span>
            <a href="/sellers" className="hover:text-blue-600">Sellers</a>
            <span>/</span>
            <span className="text-gray-900 font-medium">{seller.companyName}</span>
          </nav>

          <div className="lg:grid lg:grid-cols-5 lg:gap-8 items-start">
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
                <SellerHeader seller={seller} />
              </div>

              {(seller.industryTypes.length > 0 || location) && (
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 mb-6">
                  <h2 className="text-base font-semibold text-gray-900 mb-3">About</h2>
                  <div className="space-y-2 text-sm text-gray-600">
                    {location && <p>📍 Based in <span className="font-medium">{location}</span></p>}
                    {seller.industryTypes.length > 0 && (
                      <p>🏭 Industries: <span className="font-medium">{seller.industryTypes.join(', ')}</span></p>
                    )}
                    {seller.totalProductViews > 0 && (
                      <p>👁 <span className="font-medium">{seller.totalProductViews.toLocaleString('en-IN')}</span> total product views</p>
                    )}
                    {seller.badges.includes('IEC_GLOBAL') && (
                      <p>🌏 Registered for international exports (IEC)</p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Catalogue</h2>
                <SellerProducts sellerId={params.sellerId} />
              </div>
            </div>

            <div className="hidden lg:block lg:col-span-2">
              <div className="lg:sticky lg:top-24">
                <ContactGate sellerName={seller.companyName} />
              </div>
            </div>
          </div>

          <div className="lg:hidden mt-6">
            <ContactGate sellerName={seller.companyName} />
          </div>
        </main>
        <Footer />
      </div>
      <SellerSchema
        id={params.sellerId}
        companyName={seller.companyName}
        city={seller.city}
        state={seller.state}
        industryTypes={seller.industryTypes}
        productCount={seller.productCount}
      />
    </>
  )
}
