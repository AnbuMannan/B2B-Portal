import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://b2b-portal.in';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

// ISR: regenerate once per 24 hours
export const revalidate = 86400;

async function fetchIds(path: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.ids ?? json.data ?? []) as string[];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/sellers`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/buy-leads`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ];

  // Dynamic routes — fetch IDs in parallel
  const [productIds, categoryIds, sellerIds] = await Promise.all([
    fetchIds('/api/products/sitemap-ids'),
    fetchIds('/api/categories/sitemap-ids'),
    fetchIds('/api/sellers/sitemap-ids'),
  ]);

  const productRoutes: MetadataRoute.Sitemap = productIds.map((id) => ({
    url: `${BASE_URL}/product/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categoryIds.map((id) => ({
    url: `${BASE_URL}/category/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const sellerRoutes: MetadataRoute.Sitemap = sellerIds.map((id) => ({
    url: `${BASE_URL}/seller/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...sellerRoutes];
}
