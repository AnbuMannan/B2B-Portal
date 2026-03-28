import type { Metadata } from 'next'
import Header from '@/components/homepage/Header'
import LiveBuyLeadTicker from '@/components/homepage/LiveBuyLeadTicker'
import { HeroSection } from './components/homepage/HeroSection'
import { CategoriesGrid } from './components/homepage/CategoriesGrid'
import { LatestBuyLeads } from './components/homepage/LatestBuyLeads'
import { FeaturedSellers } from './components/homepage/FeaturedSellers'
import CTASections from '@/components/homepage/CTASections'
import Footer from '@/components/homepage/Footer'

export const metadata: Metadata = {
  title: 'B2B Marketplace - Connect with Verified Sellers Across India',
  description:
    "India's most trusted B2B marketplace. Find verified GST, IEC, MSME sellers. Connect with thousands of suppliers and buyers. Post your requirements, browse products, and grow your business.",
  keywords: ['B2B marketplace', 'sellers India', 'suppliers', 'GST verified', 'MSME', 'wholesale', 'business'],
  authors: [{ name: 'B2B Portal' }],
  openGraph: {
    title: 'B2B Marketplace - Connect with Verified Sellers Across India',
    description: "India's trusted B2B platform for buyers and sellers",
    type: 'website',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://b2b-portal.in',
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'B2B Portal',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://b2b-portal.in',
  logo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://b2b-portal.in'}/logo.svg`,
  sameAs: [
    'https://www.facebook.com',
    'https://www.linkedin.com',
    'https://twitter.com',
    'https://www.instagram.com',
  ],
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'IN',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@b2bportal.com',
      telephone: '+91-0000-000-000',
      availableLanguage: ['en', 'hi'],
    },
  ],
}

export default function HomePage() {
  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <Header />
        <LiveBuyLeadTicker />
        <HeroSection />
        <CategoriesGrid />
        <LatestBuyLeads />
        <FeaturedSellers />
        <CTASections />
        <Footer />
      </main>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
    </>
  )
}
