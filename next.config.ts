import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['googleapis', '@google-analytics/data'],
};

export default nextConfig;
