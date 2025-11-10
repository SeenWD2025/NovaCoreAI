import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(async () => {
    // Clean up Redis connections
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('incrementLoginAttempts', () => {
    it('should increment login attempts for an email', async () => {
      const email = 'test@example.com';
      
      const attempts = await service.incrementLoginAttempts(email);
      
      expect(attempts).toBe(1);
    });

    it('should increment multiple times', async () => {
      const email = 'test2@example.com';
      
      await service.incrementLoginAttempts(email);
      await service.incrementLoginAttempts(email);
      const attempts = await service.incrementLoginAttempts(email);
      
      expect(attempts).toBe(3);
    });

    it('should set expiration on first attempt', async () => {
      const email = 'test3@example.com';
      
      await service.incrementLoginAttempts(email);
      const ttl = await service.getLoginAttemptsTTL(email);
      
      // TTL should be around 15 minutes (900 seconds)
      expect(ttl).toBeGreaterThan(890);
      expect(ttl).toBeLessThanOrEqual(900);
    });
  });

  describe('getLoginAttempts', () => {
    it('should return 0 for email with no attempts', async () => {
      const email = 'nonexistent@example.com';
      
      const attempts = await service.getLoginAttempts(email);
      
      expect(attempts).toBe(0);
    });

    it('should return correct attempt count', async () => {
      const email = 'test4@example.com';
      
      await service.incrementLoginAttempts(email);
      await service.incrementLoginAttempts(email);
      
      const attempts = await service.getLoginAttempts(email);
      
      expect(attempts).toBe(2);
    });
  });

  describe('resetLoginAttempts', () => {
    it('should reset login attempts to 0', async () => {
      const email = 'test5@example.com';
      
      // Create some attempts
      await service.incrementLoginAttempts(email);
      await service.incrementLoginAttempts(email);
      
      // Reset
      await service.resetLoginAttempts(email);
      
      const attempts = await service.getLoginAttempts(email);
      expect(attempts).toBe(0);
    });
  });

  describe('generic operations', () => {
    it('should set and get a value', async () => {
      const key = 'test-key';
      const value = 'test-value';
      
      await service.set(key, value);
      const retrieved = await service.get(key);
      
      expect(retrieved).toBe(value);
    });

    it('should set value with TTL', async () => {
      const key = 'test-key-ttl';
      const value = 'test-value';
      
      await service.set(key, value, 60); // 60 seconds TTL
      const retrieved = await service.get(key);
      
      expect(retrieved).toBe(value);
    });

    it('should delete a key', async () => {
      const key = 'test-key-delete';
      const value = 'test-value';
      
      await service.set(key, value);
      await service.del(key);
      
      const retrieved = await service.get(key);
      expect(retrieved).toBeNull();
    });
  });
});
