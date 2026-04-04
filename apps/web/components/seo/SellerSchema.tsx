const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://b2b-portal.in';

interface SellerSchemaProps {
  id: string;
  companyName: string;
  city?: string | null;
  state?: string | null;
  industryTypes?: string[];
  productCount?: number;
}

export function SellerSchema({
  id,
  companyName,
  city,
  state,
  industryTypes = [],
  productCount,
}: SellerSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: companyName,
    url: `${BASE_URL}/seller/${id}`,
    ...(city || state
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(city && { addressLocality: city }),
            ...(state && { addressRegion: state }),
            addressCountry: 'IN',
          },
        }
      : {}),
    ...(industryTypes.length > 0 && { knowsAbout: industryTypes }),
    ...(productCount !== undefined && {
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        numberOfItems: productCount,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
