import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis/redis.service';

export const RateLimit = Reflector.createDecorator<{
  points: number;
  duration: number;
  keyPrefix: string;
  useIp?: boolean;
}>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitConfig = this.reflector.get(RateLimit, context.getHandler());

    if (!rateLimitConfig) {
      return true; // No rate limiting configured
    }

    const request = context.switchToHttp().getRequest();
    const { points, duration, keyPrefix, useIp = false } = rateLimitConfig;

    // Determine key based on configuration
    let identifier: string;
    if (useIp) {
      // Use IP address for rate limiting
      identifier = this.getClientIp(request);
    } else {
      // Use user ID if authenticated
      identifier = request.user?.userId || this.getClientIp(request);
    }

    const key = `${keyPrefix}:${identifier}`;

    // Get current attempts
    const currentAttempts = await this.redisService.get(key);
    const attempts = currentAttempts ? parseInt(currentAttempts, 10) : 0;

    if (attempts >= points) {
      const ttl = await this.getTTL(key);
      const minutesRemaining = Math.ceil(ttl / 60);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests. Please try again in ${minutesRemaining} minute(s).`,
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    const newAttempts = attempts + 1;
    await this.redisService.setWithExpiry(key, newAttempts.toString(), duration);

    return true;
  }

  private getClientIp(request: any): string {
    // Try to get real IP from various headers (for proxies/load balancers)
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  private async getTTL(key: string): Promise<number> {
    const client = this.redisService.getClient();
    const ttl = await client.ttl(key);
    return ttl > 0 ? ttl : 0;
  }
}
