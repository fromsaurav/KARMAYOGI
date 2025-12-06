// Redis connection utility for job queue and caching
// Provides singleton Redis instance with connection management and error handling

import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

class RedisManager {
  private static instance: RedisManager;
  private redisClient: Redis;

  private constructor() {
    this.redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: null, // Allow unlimited retries for critical operations
      lazyConnect: false,
      enableOfflineQueue: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      }
    });

    this.redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redisClient.on('error', (error) => {
      logger.error('Redis connection error', { error });
    });

    this.redisClient.on('ready', () => {
      logger.info('Redis ready for commands');
    });
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public getClient(): Redis {
    return this.redisClient;
  }

  public async disconnect(): Promise<void> {
    await this.redisClient.disconnect();
    logger.info('Redis disconnected');
  }
}

export const redisManager = RedisManager.getInstance();
export const redisClient = redisManager.getClient();