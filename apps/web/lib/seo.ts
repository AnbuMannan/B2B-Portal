import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://b2b-portal.in';
const SITE_NAME = 'B2B Portal';

// ── Canonical slug helper ─────────────────────────────────────────────────

export function slugify(text: string, maxLength = 60): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLength);
}

export function canonicalUrl(path: string): string {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// ── Product metadata ──────────────────────────────────────────────────────

interface ProductMetaInput {
  id: string;
  name: string;
  description?: string;
  images: string[];
  sellerCompanyName: string;
  categories: string[];
  pricingTiers: Array<{ price: number }>;
}

export function generateProductMeta(product: ProductMetaInput): Metadata {
  const lowestPrice =
    product.pricingTiers.length > 0
      ? Math.min(...product.pricingTiers.map((t) => t.price))
      : null;

  const title = `${product.name} - Buy from ${product.sellerCompanyName} | ${SITE_NAME}`;
  const description = `Buy ${product.name} at wholesale price from verified ${product.sellerCompanyName}.${lowestPrice ? ` Starting from ₹${lowestPrice.toLocaleString('en-IN')}.` : ''} GST verified B2B supplier. Get best quote now.`;

  return {
    title,
    description,
    keywords: [product.name, product.sellerCompanyName, 'wholesale', 'B2B', ...product.categories],
    openGraph: {
      title: `${product.name} | ${SITE_NAME}`,
      description: `Wholesale ${product.name} from verified B2B supplier — ${product.sellerCompanyName}`,
      type: 'website',
      siteName: SITE_NAME,
      images: product.images.length > 0 ? [{ url: product.images[0], alt: product.name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | ${SITE_NAME}`,
      description: `Wholesale ${product.name} — ${product.sellerCompanyName}`,
      images: product.images.length > 0 ? [product.images[0]] : [],
    },
    alternates: {
      canonical: `/product/${product.id}`,
    },
  };
}

// ── Category metadata ─────────────────────────────────────────────────────

interface CategoryMetaInput {
  id: string;
  name: string;
  productCount?: number;
  parentName?: string;
}

export function generateCategoryMeta(category: CategoryMetaInput): Metadata {
  const title = `${category.name} Suppliers & Wholesalers | ${SITE_NAME}`;
  const description = `Find verified B2B suppliers for ${category.name}.${category.productCount ? ` Browse ${category.productCount}+ wholesale products` : ''}, compare prices, and connect with trusted manufacturers and distributors across India.`;

  return {
    title,
    description,
    keywords: [category.name, 'wholesale', 'suppliers', 'B2B', 'manufacturers', 'distributors', 'India'],
    openGraph: {
      title: `${category.name} | ${SITE_NAME}`,
      description: `Wholesale ${category.name} from verified B2B suppliers in India`,
      type: 'website',
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: `${category.name} | ${SITE_NAME}`,
      description: `Wholesale ${category.name} from verified B2B suppliers`,
    },
    alternates: {
      canonical: `/category/${category.id}`,
    },
  };
}

// ── Seller metadata ───────────────────────────────────────────────────────

interface SellerMetaInput {
  id: string;
  companyName: string;
  city?: string | null;
  state?: string | null;
  productCount?: number;
  industryTypes?: string[];
}

export function generateSellerMeta(seller: SellerMetaInput): Metadata {
  const location = seller.city && seller.state
    ? `${seller.city}, ${seller.state}`
    : seller.state ?? seller.city ?? 'India';

  const title = `${seller.companyName} - Verified B2B Supplier | ${SITE_NAME}`;
  const description = `${seller.companyName} is a verified B2B supplier based in ${location}.${seller.productCount ? ` Browse ${seller.productCount}+ products` : ''} and get wholesale quotes directly.`;

  return {
    title,
    description,
    keywords: [seller.companyName, 'B2B supplier', 'wholesale', location, ...(seller.industryTypes ?? [])],
    openGraph: {
      title: `${seller.companyName} | ${SITE_NAME}`,
      description: `Verified B2B supplier — ${seller.companyName} in ${location}`,
      type: 'website',
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: `${seller.companyName} | ${SITE_NAME}`,
      description: `Verified B2B supplier — ${seller.companyName}`,
    },
    alternates: {
      canonical: `/seller/${seller.id}`,
    },
  };
}

// ── Search page metadata ──────────────────────────────────────────────────

export function generateSearchMeta(query?: string): Metadata {
  const title = query
    ? `"${query}" - Search Results | ${SITE_NAME}`
    : `Search Products & Suppliers | ${SITE_NAME}`;
  const description = query
    ? `B2B search results for "${query}". Find verified suppliers, wholesale products, and manufacturers across India.`
    : 'Search India\'s largest B2B marketplace. Find verified suppliers, wholesale products, and manufacturers.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: SITE_NAME,
    },
    robots: query ? { index: false, follow: true } : { index: true, follow: true },
  };
}
