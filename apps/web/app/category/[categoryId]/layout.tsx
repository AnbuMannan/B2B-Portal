import { Metadata } from 'next';
import { generateCategoryMeta } from '@/lib/seo';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export async function generateMetadata({
  params,
}: {
  params: { categoryId: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(`${API_URL}/api/categories/${params.categoryId}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { title: 'Category | B2B Portal' };
    const json = await res.json();
    const category = json.data;
    if (!category) return { title: 'Category | B2B Portal' };
    return generateCategoryMeta({
      id: params.categoryId,
      name: category.name,
      productCount: category.productCount,
    });
  } catch {
    return { title: 'Category | B2B Portal' };
  }
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
