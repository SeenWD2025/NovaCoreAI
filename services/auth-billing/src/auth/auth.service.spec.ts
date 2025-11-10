import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';

// Don't mock crypto globally - we'll mock it per test
const crypto = require('crypto');

describe('AuthService - Email Verification', () => {
  let service: AuthService;
  let databaseService: jest.Mocked<DatabaseService>;
  let redisService: jest.Mocked<RedisService>;
  let emailService: jest.Mocked<EmailService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password_hash: 'hashedpassword',
    role: 'student',
    subscription_tier: 'free_trial',
    trial_ends_at: new Date(),
    created_at: new Date(),
    email_verified: false,
    email_verification_token: null,
    email_verification_token_expires_at: null,
  };

  beforeEach(async () => {
    // Create mock providers
    const mockDatabaseService = {
      query: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockRedisClient = {
      ttl: jest.fn().mockResolvedValue(3600),
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      setWithExpiry: jest.fn(),
      getClient: jest.fn(() => mockRedisClient),
      incrementLoginAttempts: jest.fn(),
      getLoginAttempts: jest.fn(),
      resetLoginAttempts: jest.fn(),
      getLoginAttemptsTTL: jest.fn(),
    };

    const mockEmailService = {
      sendVerificationEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    databaseService = module.get(DatabaseService) as any;
    redisService = module.get(RedisService) as any;
    emailService = module.get(EmailService) as any;
    jwtService = module.get(JwtService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail', () => {
    it('should generate token and send verification email', async () => {
      const userId = mockUser.id;
      const token = 'a'.repeat(64); // 32 bytes = 64 hex chars

      // Spy on crypto.randomBytes
      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(
        Buffer.from(token, 'hex'),
      );

      databaseService.query
        .mockResolvedValueOnce({
          rows: [{ email: mockUser.email, email_verified: false }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any); // UPDATE query

      emailService.sendVerificationEmail.mockResolvedValue(true);

      await service.sendVerificationEmail(userId);

      // Verify token generation
      expect(randomBytesSpy).toHaveBeenCalledWith(32);

      // Verify database update was called
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.any(Array),
      );

      // Verify email sent
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();

      randomBytesSpy.mockRestore();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      databaseService.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.sendVerificationEmail('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if email already verified', async () => {
      databaseService.query.mockResolvedValue({
        rows: [{ email: mockUser.email, email_verified: true }],
      } as any);

      await expect(service.sendVerificationEmail(mockUser.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw error if email sending fails', async () => {
      const token = 'a'.repeat(64);
      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(
        Buffer.from(token, 'hex'),
      );

      databaseService.query
        .mockResolvedValueOnce({
          rows: [{ email: mockUser.email, email_verified: false }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      emailService.sendVerificationEmail.mockResolvedValue(false);

      await expect(service.sendVerificationEmail(mockUser.id)).rejects.toThrow(
        HttpException,
      );

      randomBytesSpy.mockRestore();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const token = 'valid-token';
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      databaseService.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockUser.id,
              email: mockUser.email,
              email_verified: false,
              email_verification_token_expires_at: futureDate,
            },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any); // UPDATE query

      const result = await service.verifyEmail(token);

      expect(result).toEqual({
        message: 'Email verified successfully! You can now access all features.',
      });

      // Verify database update
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([mockUser.id]),
      );
    });

    it('should throw error for empty token', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow(HttpException);
      await expect(service.verifyEmail('   ')).rejects.toThrow(HttpException);
    });

    it('should throw error for invalid token', async () => {
      databaseService.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw ConflictException if email already verified', async () => {
      const token = 'valid-token';

      databaseService.query.mockResolvedValue({
        rows: [
          {
            id: mockUser.id,
            email: mockUser.email,
            email_verified: true,
            email_verification_token_expires_at: new Date(),
          },
        ],
      } as any);

      await expect(service.verifyEmail(token)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw error for expired token', async () => {
      const token = 'valid-token';
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 25); // 25 hours ago

      databaseService.query.mockResolvedValue({
        rows: [
          {
            id: mockUser.id,
            email: mockUser.email,
            email_verified: false,
            email_verification_token_expires_at: pastDate,
          },
        ],
      } as any);

      await expect(service.verifyEmail(token)).rejects.toThrow(HttpException);
    });

    it('should clear token after successful verification (single-use)', async () => {
      const token = 'valid-token';
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      databaseService.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockUser.id,
              email: mockUser.email,
              email_verified: false,
              email_verification_token_expires_at: futureDate,
            },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await service.verifyEmail(token);

      // Verify that the UPDATE query sets token to NULL
      const updateCall = databaseService.query.mock.calls.find((call) =>
        call[0].includes('email_verification_token = NULL'),
      );
      expect(updateCall).toBeDefined();
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resend verification email if under rate limit', async () => {
      const userId = mockUser.id;
      const token = 'a'.repeat(64);

      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(
        Buffer.from(token, 'hex'),
      );

      redisService.get.mockResolvedValue(null); // No previous attempts

      databaseService.query
        .mockResolvedValueOnce({
          rows: [{ email: mockUser.email, email_verified: false }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      emailService.sendVerificationEmail.mockResolvedValue(true);

      const result = await service.resendVerificationEmail(userId);

      expect(result).toEqual({
        message: 'Verification email sent successfully. Please check your inbox.',
      });

      // Verify rate limit was set
      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        `email_verify_resend:${userId}`,
        '1',
        3600,
      );

      randomBytesSpy.mockRestore();
    });

    it('should enforce rate limit (3 per hour)', async () => {
      const userId = mockUser.id;

      redisService.get.mockResolvedValue('3'); // 3 attempts already
      (redisService.getClient as jest.Mock).mockReturnValue({
        ttl: jest.fn().mockResolvedValue(1800), // 30 minutes remaining
      });

      await expect(service.resendVerificationEmail(userId)).rejects.toThrow(
        HttpException,
      );
      await expect(service.resendVerificationEmail(userId)).rejects.toThrow(
        /Too many verification email requests/,
      );
    });

    it('should increment counter on each request', async () => {
      const userId = mockUser.id;
      const token = 'a'.repeat(64);

      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(
        Buffer.from(token, 'hex'),
      );

      // Simulate 2 previous attempts
      redisService.get.mockResolvedValue('2');

      databaseService.query
        .mockResolvedValueOnce({
          rows: [{ email: mockUser.email, email_verified: false }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      emailService.sendVerificationEmail.mockResolvedValue(true);

      await service.resendVerificationEmail(userId);

      // Verify counter incremented to 3
      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        `email_verify_resend:${userId}`,
        '3',
        3600,
      );

      randomBytesSpy.mockRestore();
    });

    it('should handle errors from sendVerificationEmail', async () => {
      const userId = mockUser.id;
      const token = 'a'.repeat(64);

      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(
        Buffer.from(token, 'hex'),
      );

      redisService.get.mockResolvedValue(null);

      databaseService.query
        .mockResolvedValueOnce({
          rows: [{ email: mockUser.email, email_verified: false }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      emailService.sendVerificationEmail.mockResolvedValue(false);

      await expect(service.resendVerificationEmail(userId)).rejects.toThrow(
        HttpException,
      );

      randomBytesSpy.mockRestore();
    });
  });

  describe('Token Security', () => {
    it('should generate cryptographically secure tokens', async () => {
      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(
        Buffer.from('a'.repeat(64), 'hex'),
      );

      databaseService.query
        .mockResolvedValueOnce({
          rows: [{ email: mockUser.email, email_verified: false }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      emailService.sendVerificationEmail.mockResolvedValue(true);

      await service.sendVerificationEmail(mockUser.id);

      // Verify crypto.randomBytes was called with 32 bytes
      expect(randomBytesSpy).toHaveBeenCalledWith(32);

      randomBytesSpy.mockRestore();
    });

    it('should set 24 hour expiration on tokens', async () => {
      const userId = mockUser.id;
      const token = 'a'.repeat(64);

      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(
        Buffer.from(token, 'hex'),
      );

      databaseService.query
        .mockResolvedValueOnce({
          rows: [{ email: mockUser.email, email_verified: false }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      emailService.sendVerificationEmail.mockResolvedValue(true);

      const beforeCall = new Date();
      await service.sendVerificationEmail(userId);
      const afterCall = new Date();

      // Verify the expiration date in the database query
      const updateCall = databaseService.query.mock.calls.find((call) =>
        call[0].includes('email_verification_token_expires_at'),
      );

      expect(updateCall).toBeDefined();
      const expiresAt = updateCall![1][1] as Date;

      // Verify expiration is approximately 24 hours from now
      const expectedExpiration = new Date(beforeCall.getTime() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiration.getTime());

      // Allow 1 second tolerance for test execution time
      expect(timeDiff).toBeLessThan(1000);

      randomBytesSpy.mockRestore();
    });
  });
});
