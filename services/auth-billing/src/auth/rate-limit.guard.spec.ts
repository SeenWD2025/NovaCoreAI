import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RateLimit } from './rate-limit.guard';
import { RedisService } from '../redis/redis.service';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let redisService: jest.Mocked<RedisService>;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const mockRedisClient = {
      ttl: jest.fn().mockResolvedValue(900),
    };

    const mockRedisService = {
      get: jest.fn(),
      setWithExpiry: jest.fn(),
      getClient: jest.fn(() => mockRedisClient),
    };

    const mockReflector = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    redisService = module.get(RedisService) as any;
    reflector = module.get(Reflector) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    ip: string = '192.168.1.1',
    userId?: string,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-forwarded-for': ip },
          user: userId ? { userId } : undefined,
        }),
      }),
      getHandler: jest.fn(),
    } as any;
  };

  describe('IP-based rate limiting', () => {
    it('should allow request under rate limit', async () => {
      const context = createMockExecutionContext();

      reflector.get.mockReturnValue({
        points: 5,
        duration: 900,
        keyPrefix: 'test',
        useIp: true,
      });

      redisService.get.mockResolvedValue(null); // No previous attempts

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        'test:192.168.1.1',
        '1',
        900,
      );
    });

    it('should block request when rate limit exceeded', async () => {
      const context = createMockExecutionContext();

      reflector.get.mockReturnValue({
        points: 5,
        duration: 900,
        keyPrefix: 'test',
        useIp: true,
      });

      redisService.get.mockResolvedValue('5'); // Already at limit
      (redisService.getClient as jest.Mock).mockReturnValue({
        ttl: jest.fn().mockResolvedValue(600), // 10 minutes remaining
      });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        /Too many requests/,
      );
    });

    it('should extract IP from x-forwarded-for header', async () => {
      const context = createMockExecutionContext('10.0.0.1, 192.168.1.1');

      reflector.get.mockReturnValue({
        points: 5,
        duration: 900,
        keyPrefix: 'test',
        useIp: true,
      });

      redisService.get.mockResolvedValue(null);

      await guard.canActivate(context);

      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        'test:10.0.0.1', // First IP in the list
        '1',
        900,
      );
    });

    it('should handle multiple x-real-ip header fallback', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-real-ip': '172.16.0.1' },
          }),
        }),
        getHandler: jest.fn(),
      } as any;

      reflector.get.mockReturnValue({
        points: 5,
        duration: 900,
        keyPrefix: 'test',
        useIp: true,
      });

      redisService.get.mockResolvedValue(null);

      await guard.canActivate(context);

      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        'test:172.16.0.1',
        '1',
        900,
      );
    });
  });

  describe('User-based rate limiting', () => {
    it('should use user ID when not using IP', async () => {
      const userId = 'user-123';
      const context = createMockExecutionContext('192.168.1.1', userId);

      reflector.get.mockReturnValue({
        points: 3,
        duration: 3600,
        keyPrefix: 'user_action',
        useIp: false,
      });

      redisService.get.mockResolvedValue(null);

      await guard.canActivate(context);

      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        'user_action:user-123',
        '1',
        3600,
      );
    });

    it('should fall back to IP if user not authenticated', async () => {
      const context = createMockExecutionContext('192.168.1.1');

      reflector.get.mockReturnValue({
        points: 3,
        duration: 3600,
        keyPrefix: 'user_action',
        useIp: false,
      });

      redisService.get.mockResolvedValue(null);

      await guard.canActivate(context);

      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        'user_action:192.168.1.1',
        '1',
        3600,
      );
    });
  });

  describe('Rate limit configuration', () => {
    it('should allow request if no rate limit configured', async () => {
      const context = createMockExecutionContext();

      reflector.get.mockReturnValue(null); // No rate limit config

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.get).not.toHaveBeenCalled();
    });

    it('should increment counter correctly', async () => {
      const context = createMockExecutionContext();

      reflector.get.mockReturnValue({
        points: 5,
        duration: 900,
        keyPrefix: 'test',
        useIp: true,
      });

      redisService.get.mockResolvedValue('2'); // 2 previous attempts

      await guard.canActivate(context);

      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        'test:192.168.1.1',
        '3',
        900,
      );
    });

    it('should provide accurate retry-after information', async () => {
      const context = createMockExecutionContext();

      reflector.get.mockReturnValue({
        points: 5,
        duration: 900,
        keyPrefix: 'test',
        useIp: true,
      });

      redisService.get.mockResolvedValue('5');
      (redisService.getClient as jest.Mock).mockReturnValue({
        ttl: jest.fn().mockResolvedValue(420), // 7 minutes
      });

      try {
        await guard.canActivate(context);
        fail('Should have thrown exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        const response = httpError.getResponse() as any;

        expect(response.retryAfter).toBe(420);
        expect(response.message).toContain('7 minute');
      }
    });
  });

  describe('Email verification specific', () => {
    it('should limit to 5 attempts per 15 minutes per IP', async () => {
      const context = createMockExecutionContext();

      reflector.get.mockReturnValue({
        points: 5,
        duration: 15 * 60,
        keyPrefix: 'email_verify',
        useIp: true,
      });

      // Simulate 4 previous attempts
      redisService.get.mockResolvedValue('4');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        'email_verify:192.168.1.1',
        '5',
        900,
      );
    });

    it('should block 6th attempt', async () => {
      const context = createMockExecutionContext();

      reflector.get.mockReturnValue({
        points: 5,
        duration: 15 * 60,
        keyPrefix: 'email_verify',
        useIp: true,
      });

      redisService.get.mockResolvedValue('5');
      (redisService.getClient as jest.Mock).mockReturnValue({
        ttl: jest.fn().mockResolvedValue(600),
      });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });
  });
});
