import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { redisErrorsTotal } from '../metrics';

/**
 * Redis Service with Circuit Breaker Pattern (Issue #8)
 * Provides graceful degradation when Redis is unavailable
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;
  private isHealthy = true;
  private lastHealthCheck = Date.now();
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

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
      this.isHealthy = false;
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
      this.isHealthy = true;
    });

    this.client.on('ready', () => {
      console.log('Redis ready to accept commands');
      this.isHealthy = true;
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Check if Redis is healthy with circuit breaker logic
   */
  private shouldBypassRedis(): boolean {
    return !this.isHealthy && Date.now() - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL;
  }

  /**
   * Increment login attempt counter for a given email
   * Falls back gracefully if Redis is down
   */
  async incrementLoginAttempts(email: string): Promise<number> {
    try {
      if (this.shouldBypassRedis()) {
        console.warn('Redis unhealthy, allowing operation (rate limiting disabled)');
        return 0;
      }

      const key = `login_attempts:${email}`;
      const attempts = await this.client.incr(key);
      
      // Set expiration to 15 minutes on first attempt
      if (attempts === 1) {
        await this.client.expire(key, 15 * 60);
      }
      
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      return attempts;
    } catch (error) {
      console.error('Redis error during increment:', error);
      redisErrorsTotal.labels({ operation: 'incr' }).inc();
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      
      // Return 0 to allow operation to continue (rate limiting disabled)
      return 0;
    }
  }

  /**
   * Get current login attempt count for a given email
   * Falls back gracefully if Redis is down
   */
  async getLoginAttempts(email: string): Promise<number> {
    try {
      if (this.shouldBypassRedis()) {
        console.warn('Redis unhealthy, allowing login (no rate limiting)');
        return 0;
      }

      const key = `login_attempts:${email}`;
      const attempts = await this.client.get(key);
      
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      
      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      console.error('Redis error, marking as unhealthy:', error);
      redisErrorsTotal.labels({ operation: 'get' }).inc();
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      
      // Return 0 to allow login (rate limiting disabled during outage)
      return 0;
    }
  }

  /**
   * Reset login attempt counter for a given email
   * @param email User's email address
   */
  async resetLoginAttempts(email: string): Promise<void> {
    try {
      const key = `login_attempts:${email}`;
      await this.client.del(key);
      this.isHealthy = true;
    } catch (error) {
      console.error('Redis error during delete:', error);
      redisErrorsTotal.labels({ operation: 'del' }).inc();
      this.isHealthy = false;
      // Don't throw - allow operation to continue
    }
  }

  /**
   * Get time to live for login attempts key
   * @param email User's email address
   * @returns TTL in seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async getLoginAttemptsTTL(email: string): Promise<number> {
    try {
      const key = `login_attempts:${email}`;
      const ttl = await this.client.ttl(key);
      this.isHealthy = true;
      return ttl;
    } catch (error) {
      console.error('Redis error during TTL check:', error);
      redisErrorsTotal.labels({ operation: 'ttl' }).inc();
      this.isHealthy = false;
      return -2; // Key doesn't exist
    }
  }

  /**
   * Generic set operation with circuit breaker
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      this.isHealthy = true;
    } catch (error) {
      console.error('Redis error during set:', error);
      redisErrorsTotal.labels({ operation: 'set' }).inc();
      this.isHealthy = false;
      // Don't throw - allow operation to continue
    }
  }

  /**
   * Generic get operation with circuit breaker
   */
  async get(key: string): Promise<string | null> {
    try {
      if (this.shouldBypassRedis()) {
        return null;
      }
      const value = await this.client.get(key);
      this.isHealthy = true;
      return value;
    } catch (error) {
      console.error('Redis error during get:', error);
      redisErrorsTotal.labels({ operation: 'get' }).inc();
      this.isHealthy = false;
      return null;
    }
  }

  /**
   * Generic delete operation
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
      this.isHealthy = true;
    } catch (error) {
      console.error('Redis error during delete:', error);
      redisErrorsTotal.labels({ operation: 'del' }).inc();
      this.isHealthy = false;
    }
  }

  /**
   * Set value with expiration
   */
  async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
    return this.set(key, value, ttlSeconds);
  }
}
