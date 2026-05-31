/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  
  // Enable standalone output for containerized deployments
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    return config;
  },
};

module.exports = nextConfig;
