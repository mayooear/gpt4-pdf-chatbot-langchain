import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  // Redirect HTTP to HTTPS
  if (url.protocol === 'http:' && process.env.ENVIRONMENT !== 'dev') {
    url.protocol = 'https:';
    return NextResponse.redirect(url);
  }

  // Authentication check
  const cookie = req.cookies.get('siteAuth');
  if (
    !cookie &&
    url.pathname !== '/login' &&
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