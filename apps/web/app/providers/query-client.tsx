'use client'

import { QueryClient, QueryClientProvider as ReactQueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import React, { useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QueryClientProvider({ children }: any) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            retry: 2,
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
          },
          mutations: {
            retry: 1,
          },
        },
      })
  )

  return (
    <ReactQueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </ReactQueryClientProvider>
  )
}