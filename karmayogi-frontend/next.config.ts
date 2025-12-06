import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  // Fix workspace root warning - specify the correct project root
  outputFileTracingRoot: path.join(__dirname, '../../'),

  productionBrowserSourceMaps: false,

  eslint: {
    ignoreDuringBuilds: false,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-slot', 'class-variance-authority'],
  },

  // Optimize chunking for better loading performance
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
            },
          },
        },
      };
    }
    return config;
  },

  // Faster refresh and compilation
  reactStrictMode: false,

  // Disable strict CSP for development
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
