const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://b2b-portal.in';

export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'B2B Portal',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.svg`,
    sameAs: [
      'https://www.facebook.com',
      'https://www.linkedin.com',
      'https://twitter.com',
      'https://www.instagram.com',
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@b2bportal.com',
        telephone: '+91-0000-000-000',
        availableLanguage: ['en', 'hi'],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
