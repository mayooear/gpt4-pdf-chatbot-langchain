/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/sudoCookie',
        destination: 'https://ask.anandalibary.org/api/sudoCookie',
      },
    ];
  },
};

export default nextConfig;
