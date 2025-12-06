import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { logger } from '../utils/logger';

// Redis client for caching
let redisClient: ReturnType<typeof createClient> | null = null;

export async function initializeRedisCache() {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.error('Redis reconnection failed after 3 attempts');
            return false;
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    logger.info('Redis cache connected successfully');
    return redisClient;
  } catch (error) {
    logger.warn('Redis cache not available, continuing without cache:', error);
    redisClient = null;
    return null;
  }
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 60)
  keyPrefix?: string;
}

/**
 * Middleware to cache GET requests
 * Usage: router.get('/endpoint', cache({ ttl: 300 }), handler)
 */
export function cache(options: CacheOptions = {}) {
  const { ttl = 60, keyPrefix = 'cache' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if Redis is not available
    if (!redisClient || !redisClient.isOpen) {
      return next();
    }

    try {
      // Generate cache key from URL and query params
      const cacheKey = `${keyPrefix}:${req.originalUrl}`;

      // Try to get cached response
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        // Return cached response
        const parsed = JSON.parse(cachedData);
        res.setHeader('X-Cache', 'HIT');
        return res.json(parsed);
      }

      // Cache miss - store the original json method
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (body: any) {
        // Store in cache
        redisClient?.setEx(cacheKey, ttl, JSON.stringify(body))
          .catch((err) => logger.error('Cache write error:', err));

        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Helper function to invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  if (!redisClient || !redisClient.isOpen) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Invalidated ${keys.length} cache keys matching: ${pattern}`);
    }
  } catch (error) {
    logger.error('Cache invalidation error:', error);
  }
}

/**
 * Helper function to clear all cache
 */
export async function clearAllCache(): Promise<void> {
  if (!redisClient || !redisClient.isOpen) {
    return;
  }

  try {
    await redisClient.flushDb();
    logger.info('All cache cleared');
  } catch (error) {
    logger.error('Clear cache error:', error);
  }
}

export { redisClient };
