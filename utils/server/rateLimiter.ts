import { db } from '@/services/firebase';
import { NextApiRequest, NextApiResponse } from 'next';
import { isDevelopment } from '@/utils/env';

// 15 minutes for prod, 5 minutes for dev
const RATE_LIMIT_WINDOW_MS = isDevelopment() ? 5 * 60 * 1000 : 15 * 60 * 1000;
const MAX_REQUESTS = 8;

// Rate limiting by IP address. All uses of this contribute to counts against IP addresses.
export async function rateLimiter(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<boolean> {
  const ip =
    req.headers['x-forwarded-for']?.toString() ||
    req.socket.remoteAddress ||
    '127.0.0.1';
  const now = Date.now();

  // sharing one collection across dev and prod
  const rateLimitRef = db.collection('rateLimits').doc(ip);

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
      if (now - firstRequestTime < RATE_LIMIT_WINDOW_MS) {
        await rateLimitRef.update({
          count: count + 1,
        });
        if (count >= MAX_REQUESTS) {
          const formattedTime = new Date(firstRequestTime).toLocaleString();
          console.log(
            `rate limiter: IP ${ip} has made ${count} attempts since ${formattedTime}`,
          );
          res
            .status(429)
            .json({ message: 'Too many attempts. Please try again later.' });
          return false;
        } else {
          return true;
        }
      } else {
        await rateLimitRef.set({
          count: 1,
          firstRequestTime: now,
        });
        return true;
      }
    }
    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('FetchError:', error.message);
    } else {
      console.error('FetchError:', error);
    }
    return true;
  }
}
