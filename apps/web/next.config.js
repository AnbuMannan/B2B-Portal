/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/:path((?!auth).*)',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/:path*`,
        },
      ],
    };
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 3600,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4001',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
