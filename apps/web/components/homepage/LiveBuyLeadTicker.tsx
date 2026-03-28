'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

interface BuyLeadTickerItem {
  productName: string
  quantity: string
  country: string
  flag: string
}

interface LatestBuyLeadsPayload {
  leads: BuyLeadTickerItem[]
}

interface LatestBuyLeadsApiResponse {
  success: boolean
  data?: LatestBuyLeadsPayload
}

const fallbackLeads: BuyLeadTickerItem[] = [
  { productName: 'Electronics Components', quantity: '1000 units', country: 'India', flag: '🇮🇳' },
  { productName: 'Textile Raw Materials', quantity: '5000 kg', country: 'USA', flag: '🇺🇸' },
  { productName: 'Industrial Chemicals', quantity: '2000 L', country: 'Germany', flag: '🇩🇪' },
  { productName: 'Agricultural Products', quantity: '10000 MT', country: 'Japan', flag: '🇯🇵' },
  { productName: 'Construction Materials', quantity: '500 MT', country: 'UAE', flag: '🇦🇪' },
]

const LiveBuyLeadTicker = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const { data } = useQuery<LatestBuyLeadsApiResponse>({
    queryKey: ['homepage', 'latest-buy-leads-ticker'],
    queryFn: async () => {
      const response = await fetch('/api/homepage/latest-buy-leads', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch latest buy leads')
      }
      return response.json()
    },
    refetchInterval: 30000,
    throwOnError: false,
    retry: 1,
  })

  const leads = data?.data?.leads && data.data.leads.length > 0 ? data.data.leads : fallbackLeads

  useEffect(() => {
    if (leads.length === 0 || isPaused) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % leads.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [leads.length, isPaused])

  if (leads.length === 0) {
    return null
  }

  const currentLead = leads[currentIndex]

  return (
    <section
      className="group relative bg-blue-600 py-3 text-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container mx-auto px-4">
        <div className="hidden overflow-hidden md:block">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" aria-hidden="true" />
              <span>Live Buy Leads</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex space-x-8 whitespace-nowrap animate-marquee group-hover:[animation-play-state:paused]">
                {leads.map((lead, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <span className="font-semibold">{lead.productName}</span>
                    <span className="text-blue-100">{lead.quantity}</span>
                    <span className="flex items-center space-x-1 text-blue-100">
                      <span>|</span>
                      <span>{lead.flag}</span>
                      <span>{lead.country}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center md:hidden">
          <div className="flex flex-col items-center space-y-1 text-sm">
            <div className="font-semibold">{currentLead.productName}</div>
            <div className="flex items-center space-x-2 text-blue-100">
              <span>{currentLead.quantity}</span>
              <span className="flex items-center space-x-1">
                <span>{currentLead.flag}</span>
                <span>{currentLead.country}</span>
              </span>
            </div>
          </div>
          <div className="mt-2 flex justify-center space-x-2">
            {leads.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-2 w-2 rounded-full ${index === currentIndex ? 'bg-white' : 'bg-blue-300'}`}
                aria-label={`Show live lead ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute right-4 top-3 flex items-center space-x-1 text-xs font-medium">
          <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          <span>Live</span>
        </div>
      </div>
    </section>
  )
}

export default LiveBuyLeadTicker
