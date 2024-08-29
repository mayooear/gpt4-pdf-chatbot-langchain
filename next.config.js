import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './utils/server/loadEnv.js';

// Only load from .env file in development
if (process.env.NODE_ENV === 'development') {
  loadEnv();
}

const site = process.env.SITE_ID || 'default';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'site-config', 'config.json');
const configData = fs.readFileSync(configPath, 'utf8');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { dev, isServer }) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };

    if (dev && !isServer) {
      // Disable optimization in development mode
      config.optimization = {
        ...config.optimization,
        splitChunks: false,
      };
    }

    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/sudoCookie',
        // TODO: change this to the correct URL for the site
        destination: 'https://ask.anandalibary.org/api/sudoCookie',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  env: {
    SITE_ID: site,
    NEXT_PUBLIC_DISABLE_ANALYTICS:
      process.env.NEXT_PUBLIC_DISABLE_ANALYTICS || 'false',
    SITE_CONFIG: configData,
  },
};

export default nextConfig;
