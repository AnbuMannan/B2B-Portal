import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Product on B2B Portal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface Params { productId: string }

export default async function Image({ params }: { params: Params }) {
  // Fetch minimal product data for the OG image
  let name = 'B2B Product';
  let sellerName = '';
  let price = '';
  let primaryImage: string | null = null;

  try {
    const res = await fetch(`${API_URL}/api/products/${params.productId}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = await res.json();
      const p = json?.data ?? json;
      name = p?.name ?? name;
      sellerName = p?.seller?.companyName ?? '';
      const tiers: { price: number }[] = p?.pricingTiers ?? [];
      const cheapest = tiers.sort((a, b) => a.price - b.price)[0];
      if (cheapest) {
        price = `₹${cheapest.price.toLocaleString('en-IN')} / ${p?.unit ?? 'Unit'}`;
      }
      const images: { fileUrl?: string }[] = p?.images ?? [];
      primaryImage = images[0]?.fileUrl
        ? `${API_URL}${images[0].fileUrl}`
        : null;
    }
  } catch {
    // Use defaults on error
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)',
          fontFamily: 'system-ui, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Left content panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '64px',
            flex: 1,
            gap: '20px',
          }}
        >
          {/* Platform badge */}
          <div
            style={{
              display: 'flex',
              background: '#f59e0b',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '14px',
              fontWeight: 700,
              color: '#1e3a5f',
              width: 'fit-content',
              letterSpacing: '0.5px',
            }}
          >
            B2B PORTAL
          </div>

          {/* Product name */}
          <div
            style={{
              fontSize: '42px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              maxWidth: '560px',
            }}
          >
            {name.length > 60 ? name.slice(0, 60) + '…' : name}
          </div>

          {/* Seller name */}
          {sellerName && (
            <div style={{ fontSize: '20px', color: '#93c5fd' }}>
              by {sellerName}
            </div>
          )}

          {/* Price */}
          {price && (
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#34d399',
              }}
            >
              {price}
            </div>
          )}

          {/* CTA */}
          <div
            style={{
              marginTop: '8px',
              fontSize: '16px',
              color: '#94a3b8',
            }}
          >
            View product details &amp; get quotes on b2bportal.in
          </div>
        </div>

        {/* Right image panel */}
        {primaryImage && (
          <div
            style={{
              width: '340px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryImage}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {!primaryImage && (
          <div
            style={{
              width: '340px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              fontSize: '120px',
            }}
          >
            📦
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
