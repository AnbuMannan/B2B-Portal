import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { QueryClientProvider } from './providers/query-client'
import { AuthProvider } from './providers/auth'
import { ThemeProvider } from './providers/theme'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'B2B Marketplace - Enterprise Business Platform',
  description: 'Enterprise-grade B2B marketplace platform connecting businesses across India',
  keywords: 'B2B, marketplace, enterprise, business, India, suppliers, buyers',
  authors: [{ name: 'B2B Marketplace Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://b2bmarketplace.com',
    siteName: 'B2B Marketplace',
    title: 'B2B Marketplace - Enterprise Business Platform',
    description: 'Enterprise-grade B2B marketplace platform connecting businesses across India',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@b2bmarketplace',
    creator: '@b2bmarketplace',
  },
  manifest: '/manifest.json',
  themeColor: '#2563eb',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryClientProvider>
            <AuthProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem={false}
                disableTransitionOnChange
              >
                {children}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#363636',
                      color: '#fff',
                    },
                    success: {
                      duration: 3000,
                      iconTheme: {
                        primary: '#10b981',
                        secondary: '#fff',
                      },
                    },
                    error: {
                      duration: 5000,
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                      },
                    },
                  }}
                />
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
