import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Increment login attempt counter for a given email
   * @param email User's email address
   * @returns Current attempt count
   */
  async incrementLoginAttempts(email: string): Promise<number> {
    const key = `login_attempts:${email}`;
    const attempts = await this.client.incr(key);
    
    // Set expiration to 15 minutes on first attempt
    if (attempts === 1) {
      await this.client.expire(key, 15 * 60); // 15 minutes in seconds
    }
    
    return attempts;
  }

  /**
   * Get current login attempt count for a given email
   * @param email User's email address
   * @returns Current attempt count
   */
  async getLoginAttempts(email: string): Promise<number> {
    const key = `login_attempts:${email}`;
    const attempts = await this.client.get(key);
    return attempts ? parseInt(attempts, 10) : 0;
  }

  /**
   * Reset login attempt counter for a given email
   * @param email User's email address
   */
  async resetLoginAttempts(email: string): Promise<void> {
    const key = `login_attempts:${email}`;
    await this.client.del(key);
  }

  /**
   * Get time to live for login attempts key
   * @param email User's email address
   * @returns TTL in seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async getLoginAttemptsTTL(email: string): Promise<number> {
    const key = `login_attempts:${email}`;
    return await this.client.ttl(key);
  }

  /**
   * Generic set operation
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Generic get operation
   */
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * Generic delete operation
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Set value with expiration
   */
  async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }
}
