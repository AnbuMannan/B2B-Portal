'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, LayoutDashboard, LogOut, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SearchBar } from '../search/SearchBar'
import { LanguageToggle } from '../i18n/LanguageToggle'

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

const Header = () => {
  const router = useRouter()
  const t = useTranslations('nav')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [userInfo, setUserInfo] = useState<JwtPayload | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      const payload = decodeJwtPayload(token)
      if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
        setUserInfo(payload)
      } else {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
  }, [])

  const isAuthenticated = !!userInfo
  const displayName = userInfo?.email?.split('@')[0] || t('myAccount')
  const dashboardHref =
    userInfo?.role === 'SELLER'
      ? '/seller/dashboard'
      : userInfo?.role === 'BUYER'
        ? '/buyer/dashboard'
        : '/'

  const handleSignOut = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUserInfo(null)
    setIsAccountOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/90 dark:bg-gray-950/90 backdrop-blur-md overflow-hidden">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8"
        aria-label="Main navigation"
      >
        <Link href="/" className="flex shrink-0 items-center gap-2 text-xl font-bold text-primary" aria-label="Go to homepage">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            B2B
          </span>
          <span className="hidden sm:inline">Marketplace</span>
        </Link>

        {/* Global search bar */}
        <div className="hidden flex-1 md:flex md:max-w-md lg:max-w-xl">
          <SearchBar placeholder={t('searchPlaceholder')} className="w-full" />
        </div>

        <div className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/browse" className="hover:text-foreground">{t('products')}</Link>
          <Link href="/sell" className="hover:text-foreground">{t('sellers')}</Link>
          <Link href="/buyer/requirements/new" className="hover:text-foreground">{t('postRequirement')}</Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageToggle />

          {!isAuthenticated && (
            <>
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t('signIn')}
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                {t('signUp')}
              </Link>
            </>
          )}

          {isAuthenticated && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </span>
                <span className="max-w-[120px] truncate">{displayName}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {isAccountOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-lg bg-card p-1 shadow-lg ring-1 ring-border">
                  <Link
                    href={dashboardHref}
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    <span>{t('dashboard')}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t('signOut')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card p-2 text-foreground shadow-sm"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <div className="flex h-5 w-5 flex-col justify-between">
              <span className={`h-0.5 w-full bg-foreground transition-transform ${isMenuOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
              <span className={`h-0.5 w-full bg-foreground transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`h-0.5 w-full bg-foreground transition-transform ${isMenuOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
            </div>
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-muted-foreground">
            <Link href="/browse" className="hover:text-foreground">{t('products')}</Link>
            <Link href="/sell" className="hover:text-foreground">{t('sellers')}</Link>
            <Link href="/buyer/requirements/new" className="hover:text-foreground">{t('postRequirement')}</Link>
            <div className="mt-2 border-t border-border pt-3">
              {!isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <Link href="/auth/signin" className="hover:text-foreground">{t('signIn')}</Link>
                  <Link href="/auth/signup" className="rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
                    {t('signUp')}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href={dashboardHref} onClick={() => setIsMenuOpen(false)} className="hover:text-foreground">
                    {t('dashboard')}
                  </Link>
                  <button type="button" onClick={handleSignOut} className="text-left text-destructive hover:text-destructive">
                    {t('signOut')}
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

export default Header
