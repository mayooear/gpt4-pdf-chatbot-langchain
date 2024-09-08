import { Redis } from '@upstash/redis';
import { isDevelopment } from '@/utils/env';

let redis: Redis | null = null;

export const CACHE_EXPIRATION = isDevelopment() ? 3600 : 86400; // 1 hour for dev, 24 hours for prod

export function initializeRedis() {
  if (redis === null) {
    try {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      // Test the connection
      redis.ping();
    } catch (error) {
      console.error('Redis Cache not available:', error);
      redis = null; // Ensure redis is set to null if connection fails
    }
  }
  return redis;
}

export async function getFromCache<T>(key: string): Promise<T | null> {
  const redisClient = initializeRedis();
  if (!redisClient) return null;

  try {
    const cachedData = await redisClient.get<string | null>(key);
    return cachedData ? (JSON.parse(cachedData) as T) : null;
  } catch (error) {
    console.error(`Error fetching from cache for key '${key}':`, error);
    return null;
  }
}

export async function setInCache(
  key: string,
  value: string | number | boolean | null | object,
  expiration: number = CACHE_EXPIRATION,
): Promise<void> {
  const redisClient = initializeRedis();
  if (!redisClient) return;

  try {
    await redisClient.set(key, JSON.stringify(value), { ex: expiration });
  } catch (error) {
    console.error(`Error setting in cache for key '${key}':`, error);
  }
}
