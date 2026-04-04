const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://b2b-portal.in';

export function SearchBoxSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'B2B Portal',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
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
