'use client';

import { useQuery } from '@tanstack/react-query';

interface TrustMetric {
  label: string;
  value: string;
  icon: string;
}

interface HeroDataResponse {
  trustMetrics: TrustMetric[];
}

const TrustSignals = () => {
  const { data, error } = useQuery<HeroDataResponse>({
    queryKey: ['hero-data'],
    queryFn: async () => {
      const response = await fetch('/api/homepage/hero-data');
      if (!response.ok) {
        throw new Error('Failed to fetch hero data');
      }
      return response.json();
    },
  });

  // Fallback data in case API is not ready
  const fallbackMetrics: TrustMetric[] = [
    { label: '₹1000+ Cr GMV', value: '1000+', icon: 'gmv' },
    { label: 'GST Verified Badge System', value: '500+', icon: 'gst-verified' },
    { label: 'IEC Global Exporters', value: '200+', icon: 'global-export' },
    { label: 'MSME Support', value: '1000+', icon: 'msme' },
  ];

  const metrics = data?.trustMetrics || fallbackMetrics;

  const getIcon = (icon: string) => {
    switch (icon) {
      case 'gmv':
        return '💰';
      case 'gst-verified':
        return '✅';
      case 'global-export':
        return '🌍';
      case 'msme':
        return '🏢';
      default:
        return '✅';
    }
  };

  if (error) {
    return (
      <section className="bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-red-600">
            Failed to load trust metrics
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-50 py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <div 
              key={index}
              className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl mb-4">
                {getIcon(metric.icon)}
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-2">
                {metric.value}
              </div>
              <div className="text-gray-600">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSignals;