import { db } from '@/services/firebase';
import { isDevelopment } from '@/utils/env';
import { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/utils/server/sudoCookieUtils';

type RateLimitConfig = {
  windowMs: number;
  max: number;
  name: string;
  collectionPrefix?: string;
};

const defaultRateLimitConfig: Partial<RateLimitConfig> = {
  windowMs: isDevelopment() ? 180 * 1000 : 60 * 1000, // 3 minutes for dev, 1 minute for prod
  max: 25,
  collectionPrefix: isDevelopment() ? 'dev' : 'prod',
};

export async function genericRateLimiter(
  req: NextApiRequest | NextRequest,
  res: NextApiResponse | NextResponse | null,
  config: RateLimitConfig,
  ip?: string,
): Promise<boolean> {
  const { windowMs, max, name, collectionPrefix } = {
    ...defaultRateLimitConfig,
    ...config,
  };

  let clientIP: string | undefined;

  if (ip) {
    clientIP = ip;
  } else if ('headers' in req && req.headers instanceof Headers) {
    // NextRequest
    clientIP = req.headers.get('x-forwarded-for')?.split(',')[0];
  } else if ('headers' in req) {
    // NextApiRequest
    const forwardedFor = (
      req.headers as Record<string, string | string[] | undefined>
    )['x-forwarded-for'];
    clientIP = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    if (!clientIP) {
      clientIP = (req as NextApiRequest).socket?.remoteAddress;
    }
  }

  clientIP = clientIP || 'unknown';

  const now = Date.now();
  const rateLimitRef = db
    .collection(`${collectionPrefix}_${name}_rateLimits`)
    .doc(clientIP);

  try {
    const rateLimitDoc = await rateLimitRef.get();
    if (!rateLimitDoc.exists) {
      await rateLimitRef.set({
        count: 1,
        firstRequestTime: now,
      });
      return true;
    }

    const rateLimitData = rateLimitDoc.data();
    if (rateLimitData) {
      const { count, firstRequestTime } = rateLimitData;
      if (now - firstRequestTime < windowMs) {
        if (count >= max) {
          console.log(`Rate limit exceeded for IP ${clientIP}`);
          if (res) {
            if ('status' in res && typeof res.status === 'function') {
              res.status(429).json({
                message: `Too many ${name} requests, please try again later.`,
              });
            } else if (res instanceof NextResponse) {
              return false;
            }
          }
          return false;
        }
        await rateLimitRef.update({
          count: count + 1,
        });
      } else {
        await rateLimitRef.set({
          count: 1,
          firstRequestTime: now,
        });
      }
      return true;
    }
    return true;
  } catch (error) {
    console.error('RateLimiterError:', error);
    return true; // Allow the request in case of an error
  }
}

export async function deleteRateLimitCounter(
  req: NextApiRequest,
  name: string,
): Promise<void> {
  const ip = getClientIp(req);
  const key = `${ip}`;
  const collectionName = `${defaultRateLimitConfig.collectionPrefix}_${name}_rateLimits`;

  try {
    const docRef = db.collection(collectionName).doc(key);
    const doc = await docRef.get();

    if (doc.exists) {
      await docRef.delete();
    } else {
      console.warn(
        `No rate limit counter found for ${key}. Nothing to delete.`,
      );
    }
  } catch (error) {
    console.error(`Error deleting rate limit counter for ${key}:`, error);
  }
}
