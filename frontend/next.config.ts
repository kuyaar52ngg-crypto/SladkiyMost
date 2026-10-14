import type { NextConfig } from 'next';

// Браузер ходит в /api/* того же origin — Next проксирует запросы в FastAPI
// (поэтому cookie сессии, которую ставит бэкенд, работает без CORS).
const backend = process.env.BACKEND_URL || 'http://localhost:8000';

const config: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default config;
