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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://*.google-analytics.com https://*.googletagmanager.com data:; media-src 'self' https://ananda-chatbot.s3.us-west-1.amazonaws.com"
          },
        ],
      },
    ];
  },
  onDemandEntries: {
    logLevel: 'debug',
  },
};

export default nextConfig;