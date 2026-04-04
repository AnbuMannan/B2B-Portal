interface PricingTier {
  price: number;
  moq: number;
}

interface ProductSchemaProps {
  name: string;
  description?: string;
  images: string[];
  sellerName: string;
  pricingTiers: PricingTier[];
  hsnCode?: string;
}

export function ProductSchema({
  name,
  description,
  images,
  sellerName,
  pricingTiers,
  hsnCode,
}: ProductSchemaProps) {
  const lowestPrice =
    pricingTiers.length > 0 ? Math.min(...pricingTiers.map((t) => t.price)) : null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(description && { description }),
    image: images,
    ...(hsnCode && { gtin: hsnCode }),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      ...(lowestPrice !== null && { lowPrice: lowestPrice }),
      offerCount: pricingTiers.length,
      seller: {
        '@type': 'Organization',
        name: sellerName,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
