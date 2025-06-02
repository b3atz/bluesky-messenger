/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Use static export for production build (served by backend)
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Set trailing slash to false
  trailingSlash: false,

  // Skip build step in development
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },

  // Environment variables
  env: {
    CUSTOM_KEY: 'value',
  },

  // Webpack configuration for compatibility
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },

  // In development, proxy API requests to backend
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3001/api/:path*',
        },
        {
          source: '/auth/:path*',
          destination: 'http://localhost:3001/auth/:path*',
        },
        {
          source: '/dm/:path*',
          destination: 'http://localhost:3001/dm/:path*',
        },
        {
          source: '/posts/:path*',
          destination: 'http://localhost:3001/posts/:path*',
        },
        {
          source: '/health',
          destination: 'http://localhost:3001/health',
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;