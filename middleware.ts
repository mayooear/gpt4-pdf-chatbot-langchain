import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isDevelopment } from '@/utils/env';

export function middleware(req: NextRequest) {
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

  // Authentication check
  const cookie = req.cookies.get('siteAuth');
  if (
    !cookie &&
    url.pathname !== '/login' &&
    !(url.pathname.startsWith('/answers/') && url.pathname !== '/answers/') && 
    !url.pathname.startsWith('/_next') &&
    !url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/favicon.ico') &&
    !url.pathname.startsWith('/robots.txt') &&
    !url.pathname.endsWith('.png') &&
    !url.pathname.endsWith('.jpg') &&
    !url.pathname.endsWith('.gif')
  ) {
    url.pathname = '/login';
    url.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}