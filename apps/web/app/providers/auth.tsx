'use client'

import { SessionProvider } from 'next-auth/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AuthProvider({ children }: any) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  )
}