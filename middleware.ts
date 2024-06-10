import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const cookie = req.cookies.get('siteAuth');

  // if (
  //   !cookie &&
  //   url.pathname !== '/login' &&
  //   !url.pathname.startsWith('/_next') &&
  //   !url.pathname.startsWith('/api') &&
  //   !url.pathname.startsWith('/favicon.ico') &&
  //   !url.pathname.endsWith('.png') &&
  //   !url.pathname.endsWith('.jpg') &&
  //   !url.pathname.endsWith('.gif')
  // ) {
  //   url.pathname = '/login';
  //   url.searchParams.set('redirect', req.nextUrl.pathname);
  //   return NextResponse.redirect(url);
  // }

  return NextResponse.next();
}
