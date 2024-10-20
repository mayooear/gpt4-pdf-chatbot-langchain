import { NextRequest, NextResponse } from 'next/server';
import { isDevelopment } from '@/utils/env';
import { isTokenValid } from '@/utils/server/passwordUtils';
import CryptoJS from 'crypto-js';
import { loadSiteConfigSync } from '@/utils/server/loadSiteConfig';

export function middleware(req: NextRequest) {
  const response = NextResponse.next();
  const url = req.nextUrl.clone();

  // Redirect /all to /answers, preserving query parameters
  if (url.pathname === '/all') {
    url.pathname = '/answers';
    return NextResponse.redirect(url, { status: 308 }); // 308 is for permanent redirect
  }

  // Redirect HTTP to HTTPS
  if (url.protocol === 'http:' && !isDevelopment()) {
    url.protocol = 'https:';
    return NextResponse.redirect(url);
  }

  const siteId = process.env.SITE_ID || 'default';
  const siteConfig = loadSiteConfigSync(siteId);

  if (!siteConfig) {
    console.error(`Configuration not found for site ID: ${siteId}`);
    return NextResponse.next();
  }

  const { requireLogin } = siteConfig;

  const allowed_paths_starts = [
    '/login',
    '/robots.txt',
    '/favicon.ico',
    '/contact',
    '/api/',
    '/_next',
    '/survey',
  ];

  const pathname_is_private =
    !allowed_paths_starts.some((path) => url.pathname.startsWith(path)) &&
    !(url.pathname.startsWith('/answers/') && url.pathname !== '/answers/') &&
    !url.pathname.endsWith('.png') &&
    !url.pathname.endsWith('.jpg') &&
    !url.pathname.endsWith('.gif');

  if (pathname_is_private && requireLogin) {
    // Authentication check
    const cookie = req.cookies.get('siteAuth');
    const storedHashedToken = process.env.SECURE_TOKEN_HASH;
    if (
      !cookie ||
      CryptoJS.SHA256(cookie.value.split(':')[0]).toString() !==
        storedHashedToken ||
      !isTokenValid(cookie.value)
    ) {
      console.log('Authentication failed');

      // For API routes, return a 401 Unauthorized response
      if (url.pathname.startsWith('/api')) {
        const response = new NextResponse(
          JSON.stringify({
            success: false,
            message: 'Authentication required',
          }),
          {
            status: 401,
            headers: {
              'content-type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          },
        );
        return response;
      }

      // For other routes, redirect to login
      const fullPath = `${url.pathname}${url.search}`;
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', fullPath);

      return NextResponse.redirect(loginUrl);
    }
  }

  const allowedOrigins = [process.env.NEXT_PUBLIC_BASE_URL];
  const origin = req.headers.get('origin');

  const corsHeaders: {
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Allow-Origin'?: string;
  } = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else {
    // If the origin is not in the allowed list, don't set the header
    // This will result in the browser blocking the request
    console.warn(`Blocked request from unauthorized origin: ${origin}`);
  }

  if (url.pathname === '/api/chat') {
    return NextResponse.next();
  }

  // Add security headers (similar to Helmet)
  const securityHeaders = {
    'Content-Security-Policy': `
      default-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL};
      script-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://*.googletagmanager.com;
      connect-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com;
      style-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} 'unsafe-inline' https://fonts.googleapis.com https://www.googletagmanager.com;
      font-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://fonts.gstatic.com data:;
      img-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://www.google-analytics.com https://www.googletagmanager.com https://fonts.gstatic.com data:;
      media-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://ananda-chatbot.s3.us-west-1.amazonaws.com blob:;
      frame-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be;
    `
      .replace(/\s{2,}/g, ' ')
      .trim(),
    'X-XSS-Protection': '1; mode=block',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  };

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
