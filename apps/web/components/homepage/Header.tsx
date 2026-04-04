'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { ChevronDown, LayoutDashboard, MessageSquare, LogOut, User } from 'lucide-react'
import { SearchBar } from '../search/SearchBar'

const Header = () => {
  const { data: session, status } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)

  const isAuthenticated = status === 'authenticated'
  const displayName =
    (session?.user?.name && session.user.name.split(' ')[0]) || session?.user?.email || 'My Account'

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-md">
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
          <SearchBar placeholder="Search products, suppliers…" className="w-full" />
        </div>

        <div className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/browse" className="hover:text-foreground">
            Browse
          </Link>
          <Link href="/sell" className="hover:text-foreground">
            Sell
          </Link>
          <Link href="/post-requirement" className="hover:text-foreground">
            Post Requirement
          </Link>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {!isAuthenticated && (
            <>
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                aria-label="Sign in to your account"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                aria-label="Create a free account"
              >
                Join Free
              </Link>
            </>
          )}

          {isAuthenticated && (
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isAccountOpen}
                aria-label="Open account menu"
                onClick={() => setIsAccountOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="max-w-[120px] truncate">{displayName}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
              {isAccountOpen && (
                <div
                  role="menu"
                  aria-label="Account"
                  className="absolute right-0 mt-2 w-52 rounded-lg bg-card p-1 shadow-lg ring-1 ring-border"
                >
                  <Link
                    href="/dashboard"
                    role="menuitem"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    href="/messages"
                    role="menuitem"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>Messages</span>
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-border bg-card p-2 text-foreground shadow-sm md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <div className="flex h-5 w-5 flex-col justify-between">
            <span
              className={`h-0.5 w-full bg-foreground transition-transform ${
                isMenuOpen ? 'translate-y-1.5 rotate-45' : ''
              }`}
            />
            <span className={`h-0.5 w-full bg-foreground transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
            <span
              className={`h-0.5 w-full bg-foreground transition-transform ${
                isMenuOpen ? '-translate-y-1.5 -rotate-45' : ''
              }`}
            />
          </div>
        </button>
      </nav>

      {isMenuOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-muted-foreground" aria-label="Mobile navigation">
            <Link href="/browse" className="hover:text-foreground">
              Browse
            </Link>
            <Link href="/sell" className="hover:text-foreground">
              Sell
            </Link>
            <Link href="/post-requirement" className="hover:text-foreground">
              Post Requirement
            </Link>
            <div className="mt-2 border-t border-border pt-3">
              {!isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <Link href="/auth/signin" className="hover:text-foreground">
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    Join Free
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/dashboard" className="hover:text-foreground">
                    Dashboard
                  </Link>
                  <Link href="/messages" className="hover:text-foreground">
                    Messages
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="text-left text-destructive hover:text-destructive"
                  >
                    Sign Out
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