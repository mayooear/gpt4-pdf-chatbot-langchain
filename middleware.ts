import { NextRequest, NextResponse } from 'next/server';
import { isDevelopment } from '@/utils/env';
import { isTokenValid } from '@/utils/server/passwordUtils';
import CryptoJS from 'crypto-js';
import { loadSiteConfigSync } from '@/utils/server/loadSiteConfig';

// Log suspicious activity with details
const logSuspiciousActivity = (req: NextRequest, reason: string) => {
  const clientIP = req.ip || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const method = req.method;
  const url = req.url;
  console.warn(
    `Suspicious activity detected: ${reason}. IP: ${clientIP}, User-Agent: ${userAgent}, Method: ${method}, URL: ${url}`,
  );
};

// Perform various security checks on the incoming request
const performSecurityChecks = (req: NextRequest, url: URL) => {
  if (url.pathname.includes('..') || url.pathname.includes('//')) {
    logSuspiciousActivity(req, 'Potential path traversal attempt');
  }

  if (req.headers.get('x-forwarded-for')?.includes(',')) {
    logSuspiciousActivity(
      req,
      'Multiple IP addresses in X-Forwarded-For header',
    );
  }

  // Check for unusually long URLs
  if (url.pathname.length > 255) {
    logSuspiciousActivity(req, 'Unusually long URL');
  }

  // Check for SQL injection attempts in query parameters
  const sqlInjectionPattern = /(\%27)|(\')|(\-\-)|(\%23)|(#)/i;
  if (sqlInjectionPattern.test(url.search)) {
    logSuspiciousActivity(
      req,
      'Potential SQL injection attempt in query parameters',
    );
  }

  // Check for unusual or suspicious user agents
  const suspiciousUserAgents = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'python-requests',
    'curl',
    'wget',
    'burp',
  ];
  const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';
  if (suspiciousUserAgents.some((agent) => userAgent.includes(agent))) {
    logSuspiciousActivity(req, 'Suspicious user agent detected');
  }

  // Check for attempts to access sensitive files
  const sensitiveFiles = [
    '.env',
    'wp-config.php',
    '.git',
    '.htaccess',
    'config.json',
    'secrets.yaml',
  ];
  if (
    sensitiveFiles.some((file) => url.pathname.toLowerCase().includes(file))
  ) {
    logSuspiciousActivity(req, 'Attempt to access potentially sensitive file');
  }

  // Check for unusual HTTP methods
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  if (!allowedMethods.includes(req.method)) {
    logSuspiciousActivity(req, `Unusual HTTP method: ${req.method}`);
  }

  // Check for missing or suspicious referer header for POST requests
  if (req.method === 'POST') {
    const referer = req.headers.get('referer');
    if (
      !referer ||
      !referer.startsWith(process.env.NEXT_PUBLIC_BASE_URL || '')
    ) {
      logSuspiciousActivity(
        req,
        'Missing or suspicious referer for POST request',
      );
    }
  }

  // Check for excessive number of cookies
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader && cookieHeader.split(';').length > 30) {
    logSuspiciousActivity(req, 'Excessive number of cookies');
  }

  // Check for potential XSS attempts in query parameters
  const xssPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  if (xssPattern.test(decodeURIComponent(url.search))) {
    logSuspiciousActivity(req, 'Potential XSS attempt in query parameters');
  }

  // Check for unusual content-type headers
  const contentType = req.headers.get('content-type');
  if (
    contentType &&
    ![
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
    ].includes(contentType.split(';')[0])
  ) {
    logSuspiciousActivity(req, `Unusual content-type header: ${contentType}`);
  }
};

// Main middleware function
export function middleware(req: NextRequest) {
  const response = NextResponse.next();
  const url = req.nextUrl.clone();

  // Perform security checks
  performSecurityChecks(req, url);

  // Redirect /all to /answers, preserving query parameters
  if (url.pathname === '/all') {
    url.pathname = '/answers';
    return NextResponse.redirect(url, { status: 308 }); // 308 is for permanent redirect
  }

  // Redirect HTTP to HTTPS in production
  if (url.protocol === 'http:' && !isDevelopment()) {
    url.protocol = 'https:';
    return NextResponse.redirect(url);
  }

  // Load site configuration
  const siteId = process.env.SITE_ID || 'default';
  const siteConfig = loadSiteConfigSync(siteId);

  if (!siteConfig) {
    console.error(`Configuration not found for site ID: ${siteId}`);
    return NextResponse.next();
  }

  const { requireLogin } = siteConfig;

  // Define allowed paths that don't require authentication
  const allowed_paths_starts = [
    '/login',
    '/robots.txt',
    '/favicon.ico',
    '/contact',
    '/api/',
    '/_next',
    '/survey',
  ];

  // Check if the current path requires authentication
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

  // Set up CORS headers
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_BASE_URL,
    'http://localhost:3000',
  ];
  const origin = req.headers.get('origin');

  const corsHeaders: {
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Allow-Origin'?: string;
  } = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (origin) {
    if (allowedOrigins.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    } else {
      console.warn(
        `Request from unauthorized origin: ${origin}. URL: ${url.toString()}, Method: ${req.method}`,
      );
    }
  } else {
    // For same-origin requests or requests without Origin header, don't set ACAO header
    // The browser will handle this correctly
  }

  // Special handling for /api/chat route
  if (url.pathname === '/api/chat') {
    return NextResponse.next();
  }

  // Add security headers (similar to Helmet)
  const securityHeaders = {
    'Content-Security-Policy': `
      default-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL};
      script-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://*.googletagmanager.com;
      connect-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.google-analytics.com;
      style-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} 'unsafe-inline' https://fonts.googleapis.com https://www.googletagmanager.com;
      font-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://fonts.gstatic.com data:;
      img-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://www.google-analytics.com https://www.googletagmanager.com https://fonts.gstatic.com data: blob:;
      media-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://ananda-chatbot.s3.us-west-1.amazonaws.com blob:;
      frame-src 'self' ${process.env.NEXT_PUBLIC_BASE_URL} https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be;
      worker-src 'self' blob:;
      manifest-src 'self';
      base-uri 'self';
      form-action 'self';
      object-src 'none';
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

// Configure which routes the middleware should run on
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
