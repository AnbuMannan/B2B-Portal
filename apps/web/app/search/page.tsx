export const revalidate = 0;

import { Metadata } from 'next';
import { SearchPageClient } from './SearchPageClient';
import { generateSearchMeta } from '@/lib/seo';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<Metadata> {
  return generateSearchMeta(searchParams.q);
}

export default function SearchPage() {
  return <SearchPageClient />;
}
