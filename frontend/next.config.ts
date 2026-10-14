import type { NextConfig } from 'next';

// Браузер ходит в /api/* того же origin — Next проксирует запросы в FastAPI.
const backend = process.env.BACKEND_URL || 'http://localhost:8000';

const config: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default config;
