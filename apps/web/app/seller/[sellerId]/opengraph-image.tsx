import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Seller on B2B Portal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

interface Params { sellerId: string }

export default async function Image({ params }: { params: Params }) {
  let companyName = 'Verified Seller';
  let companyType = '';
  let city = '';
  let state = '';
  let isVerified = false;
  let logoUrl: string | null = null;
  let productCount = 0;

  try {
    const res = await fetch(`${API_URL}/api/sellers/${params.sellerId}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = await res.json();
      const s = json?.data ?? json;
      companyName = s?.companyName ?? companyName;
      companyType = s?.companyType ?? '';
      city = s?.city ?? '';
      state = s?.state ?? '';
      isVerified = s?.isVerified ?? false;
      logoUrl = s?.logoUrl ? `${API_URL}${s.logoUrl}` : null;
      productCount = s?.productCount ?? 0;
    }
  } catch {
    // Use defaults
  }

  const location = [city, state].filter(Boolean).join(', ');

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #0f2540 0%, #1e3a5f 100%)',
          fontFamily: 'system-ui, sans-serif',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          gap: '60px',
        }}
      >
        {/* Logo / Avatar */}
        <div
          style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: logoUrl ? 'transparent' : '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '64px',
            color: '#ffffff',
            fontWeight: 800,
            overflow: 'hidden',
            flexShrink: 0,
            border: '4px solid rgba(255,255,255,0.2)',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={companyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            companyName.slice(0, 2).toUpperCase()
          )}
        </div>

        {/* Company info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {/* Platform badge */}
          <div
            style={{
              display: 'flex',
              background: '#f59e0b',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#1e3a5f',
              width: 'fit-content',
            }}
          >
            B2B PORTAL
          </div>

          {/* Company name */}
          <div style={{ fontSize: '48px', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
            {companyName.length > 40 ? companyName.slice(0, 40) + '…' : companyName}
          </div>

          {/* Company type + verification */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {companyType && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '15px',
                  color: '#93c5fd',
                }}
              >
                {companyType.replace(/_/g, ' ')}
              </div>
            )}
            {isVerified && (
              <div
                style={{
                  background: '#065f46',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '15px',
                  color: '#34d399',
                  fontWeight: 600,
                }}
              >
                ✓ Verified Seller
              </div>
            )}
          </div>

          {/* Location + products */}
          <div style={{ display: 'flex', gap: '24px', fontSize: '18px', color: '#94a3b8' }}>
            {location && <span>📍 {location}</span>}
            {productCount > 0 && <span>📦 {productCount} Products</span>}
          </div>

          {/* CTA */}
          <div style={{ fontSize: '15px', color: '#64748b' }}>
            View seller profile &amp; catalogue on b2bportal.in
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
