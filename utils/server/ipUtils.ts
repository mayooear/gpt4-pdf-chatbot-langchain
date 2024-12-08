import { NextRequest } from 'next/server';
import { NextApiRequest } from 'next';
import { isDevelopment } from '@/utils/env';

export function getClientIp(req: NextApiRequest | NextRequest): string {
  // Special handling for development environment
  if (isDevelopment()) {
    return '127.0.0.1';
  }

  // For NextRequest (App Router)
  if ('ip' in req) {
    return req.ip || '';
  }

  // Type guard for NextRequest headers
  const isNextRequestHeaders = (headers: unknown): headers is Headers => {
    return (
      typeof headers === 'object' &&
      headers !== null &&
      'get' in headers &&
      typeof (headers as Headers).get === 'function'
    );
  };

  if (isNextRequestHeaders(req.headers)) {
    // NextRequest headers
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    if (cfConnectingIp) return cfConnectingIp;

    const xForwardedFor = req.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',');
      return ips[0].trim();
    }

    const trueClientIp = req.headers.get('true-client-ip');
    if (trueClientIp) return trueClientIp;
  } else {
    // NextApiRequest headers
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (cfConnectingIp) {
      return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    }

    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = (
        Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor
      ).split(',');
      return ips[0].trim();
    }

    const trueClientIp = req.headers['true-client-ip'];
    if (trueClientIp) {
      return Array.isArray(trueClientIp) ? trueClientIp[0] : trueClientIp;
    }

    // Fallback to socket remote address for NextApiRequest
    if ('socket' in req) {
      return req.socket.remoteAddress || '';
    }
  }

  return '';
}
