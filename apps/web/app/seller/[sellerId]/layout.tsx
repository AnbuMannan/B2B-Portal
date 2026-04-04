import { Metadata } from 'next';
import { generateSellerMeta } from '@/lib/seo';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export async function generateMetadata({
  params,
}: {
  params: { sellerId: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(`${API_URL}/api/sellers/${params.sellerId}/profile`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { title: 'Seller | B2B Portal' };
    const json = await res.json();
    const seller = json.data;
    if (!seller) return { title: 'Seller | B2B Portal' };
    return generateSellerMeta({
      id: params.sellerId,
      companyName: seller.companyName,
      city: seller.city,
      state: seller.state,
      productCount: seller.productCount,
      industryTypes: seller.industryTypes,
    });
  } catch {
    return { title: 'Seller | B2B Portal' };
  }
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
