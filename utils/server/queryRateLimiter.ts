import { db } from '@/services/firebase';
import { NextRequest } from 'next/server';
import { isDevelopment } from '@/utils/env';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function queryRateLimiter(
  req: NextRequest,
  maxQueries: number,
): Promise<boolean> {
  if (maxQueries === 0) return true; // No limit

  let clientIP =
    req.headers.get('x-forwarded-for') ||
    req.ip ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (Array.isArray(clientIP)) {
    clientIP = clientIP[0];
  }
  const now = Date.now();

  // Use different collection names for dev and prod
  const collectionPrefix = isDevelopment() ? 'dev_' : 'prod_';
  const queryLimitRef = db
    .collection(`${collectionPrefix}queryLimits`)
    .doc(clientIP);

  try {
    const queryLimitDoc = await queryLimitRef.get();
    if (!queryLimitDoc.exists) {
      await queryLimitRef.set({
        count: 1,
        firstQueryTime: now,
      });
      return true;
    }

    const queryLimitData = queryLimitDoc.data();
    if (queryLimitData) {
      const { count, firstQueryTime } = queryLimitData;
      if (now - firstQueryTime < RATE_LIMIT_WINDOW_MS) {
        if (count >= maxQueries) {
          return false;
        }
        await queryLimitRef.update({
          count: count + 1,
        });
      } else {
        await queryLimitRef.set({
          count: 1,
          firstQueryTime: now,
        });
      }
      return true;
    }
    return true;
  } catch (error) {
    console.error('QueryRateLimiterError:', error);
    return true; // Allow the query in case of an error
  }
}
