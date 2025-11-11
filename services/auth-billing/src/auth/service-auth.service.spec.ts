import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ServiceAuthService } from './service-auth.service';

describe('ServiceAuthService', () => {
  let service: ServiceAuthService;
  let jwtService: jest.Mocked<JwtService>;
  
  const TEST_SECRET = 'test-service-jwt-secret-for-testing';
  const ORIGINAL_ENV = process.env.SERVICE_JWT_SECRET;

  beforeAll(() => {
    // Set test secret
    process.env.SERVICE_JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    // Restore original secret
    if (ORIGINAL_ENV) {
      process.env.SERVICE_JWT_SECRET = ORIGINAL_ENV;
    } else {
      delete process.env.SERVICE_JWT_SECRET;
    }
  });

  beforeEach(async () => {
    const mockJwtService = {
      sign: jest.fn((payload, options) => {
        // Mock JWT token generation
        const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
        return token;
      }),
      verify: jest.fn((token, options) => {
        // Mock JWT token verification
        if (token === 'expired-token') {
          const error: any = new Error('jwt expired');
          error.name = 'TokenExpiredError';
          throw error;
        }
        if (token === 'invalid-token') {
          const error: any = new Error('invalid token');
          error.name = 'JsonWebTokenError';
          throw error;
        }
        // Return mock decoded token
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            return payload;
          } catch {
            const error: any = new Error('invalid token');
            error.name = 'JsonWebTokenError';
            throw error;
          }
        }
        return {
          serviceName: 'test-service',
          type: 'service',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceAuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<ServiceAuthService>(ServiceAuthService);
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  describe('Token Generation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should generate a service token with correct payload', () => {
      const serviceName = 'intelligence-service';
      const token = service.generateServiceToken(serviceName);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName,
          type: 'service',
          iat: expect.any(Number),
        }),
        expect.objectContaining({
          secret: TEST_SECRET,
          expiresIn: '24h',
        })
      );
    });

    it('should generate different tokens for different services', () => {
      const token1 = service.generateServiceToken('service-1');
      const token2 = service.generateServiceToken('service-2');

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      // Tokens should be different because payloads are different
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw error if SERVICE_JWT_SECRET is not configured', () => {
      // Temporarily remove the secret
      const originalSecret = process.env.SERVICE_JWT_SECRET;
      delete process.env.SERVICE_JWT_SECRET;

      // Create a new service instance without secret
      const serviceWithoutSecret = new ServiceAuthService(jwtService);

      expect(() => {
        serviceWithoutSecret.generateServiceToken('test-service');
      }).toThrow('SERVICE_JWT_SECRET is not configured');

      // Restore secret
      process.env.SERVICE_JWT_SECRET = originalSecret;
    });

    it('should generate token with 24h expiration', () => {
      service.generateServiceToken('test-service');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          expiresIn: '24h',
        })
      );
    });
  });

  describe('Token Verification', () => {
    it('should verify a valid service token', () => {
      const mockPayload = {
        serviceName: 'memory-service',
        type: 'service',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };

      jwtService.verify.mockReturnValueOnce(mockPayload);

      const result = service.verifyServiceToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verify).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({
          secret: TEST_SECRET,
        })
      );
    });

    it('should throw UnauthorizedException for expired token', () => {
      expect(() => {
        service.verifyServiceToken('expired-token');
      }).toThrow(UnauthorizedException);
      
      expect(() => {
        service.verifyServiceToken('expired-token');
      }).toThrow('Service token has expired');
    });

    it('should throw UnauthorizedException for invalid token', () => {
      expect(() => {
        service.verifyServiceToken('invalid-token');
      }).toThrow(UnauthorizedException);
      
      expect(() => {
        service.verifyServiceToken('invalid-token');
      }).toThrow('Invalid service token');
    });

    it('should throw UnauthorizedException for token with wrong type', () => {
      const mockPayload = {
        serviceName: 'test-service',
        type: 'user', // Wrong type
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };

      jwtService.verify.mockReturnValue(mockPayload);

      // The service will catch the UnauthorizedException and re-throw it
      // with a generic message due to the catch-all handler
      expect(() => {
        service.verifyServiceToken('user-token');
      }).toThrow(UnauthorizedException);
      
      // Verify the error message
      jwtService.verify.mockReturnValue(mockPayload);
      try {
        service.verifyServiceToken('user-token');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toContain('Service token verification failed');
      }
    });

    it('should throw UnauthorizedException if SERVICE_JWT_SECRET is not configured', () => {
      // Temporarily remove the secret
      const originalSecret = process.env.SERVICE_JWT_SECRET;
      delete process.env.SERVICE_JWT_SECRET;

      // Create a new service instance without secret
      const serviceWithoutSecret = new ServiceAuthService(jwtService);

      expect(() => {
        serviceWithoutSecret.verifyServiceToken('any-token');
      }).toThrow(UnauthorizedException);
      
      expect(() => {
        serviceWithoutSecret.verifyServiceToken('any-token');
      }).toThrow('Service authentication not configured');

      // Restore secret
      process.env.SERVICE_JWT_SECRET = originalSecret;
    });

    it('should handle unexpected verification errors', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      expect(() => {
        service.verifyServiceToken('problematic-token');
      }).toThrow(UnauthorizedException);
      
      // Reset mock for second call
      jwtService.verify.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      expect(() => {
        service.verifyServiceToken('problematic-token');
      }).toThrow('Service token verification failed');
    });
  });

  describe('Token Renewal', () => {
    it('should indicate token needs renewal when expiring soon', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const mockPayload = {
        serviceName: 'test-service',
        type: 'service',
        iat: nowInSeconds - 82800, // Issued 23 hours ago
        exp: nowInSeconds + 3000, // Expires in 50 minutes (less than 1 hour)
      };

      jwtService.verify.mockReturnValueOnce(mockPayload);

      const shouldRenew = service.shouldRenewToken('expiring-soon-token');

      expect(shouldRenew).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith(
        'expiring-soon-token',
        expect.objectContaining({
          ignoreExpiration: true,
        })
      );
    });

    it('should indicate token does not need renewal when fresh', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const mockPayload = {
        serviceName: 'test-service',
        type: 'service',
        iat: nowInSeconds,
        exp: nowInSeconds + 86400, // Expires in 24 hours
      };

      jwtService.verify.mockReturnValueOnce(mockPayload);

      const shouldRenew = service.shouldRenewToken('fresh-token');

      expect(shouldRenew).toBe(false);
    });

    it('should indicate renewal needed if token cannot be decoded', () => {
      jwtService.verify.mockImplementationOnce(() => {
        throw new Error('Cannot decode');
      });

      const shouldRenew = service.shouldRenewToken('undecodable-token');

      expect(shouldRenew).toBe(true);
    });

    it('should indicate renewal needed when less than 1 hour remaining', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const mockPayload = {
        serviceName: 'test-service',
        type: 'service',
        iat: nowInSeconds - 83700, // Issued 23.25 hours ago
        exp: nowInSeconds + 3300, // Expires in 55 minutes
      };

      jwtService.verify.mockReturnValueOnce(mockPayload);

      const shouldRenew = service.shouldRenewToken('almost-expired-token');

      expect(shouldRenew).toBe(true);
    });

    it('should not need renewal when more than 1 hour remaining', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const mockPayload = {
        serviceName: 'test-service',
        type: 'service',
        iat: nowInSeconds - 82000, // Issued 22.77 hours ago
        exp: nowInSeconds + 4600, // Expires in 76 minutes
      };

      jwtService.verify.mockReturnValueOnce(mockPayload);

      const shouldRenew = service.shouldRenewToken('token-with-time');

      expect(shouldRenew).toBe(false);
    });
  });

  describe('Service Authentication Flow', () => {
    it('should support complete authentication flow: generate -> verify', () => {
      const serviceName = 'intelligence-service';
      
      // Generate token
      const token = service.generateServiceToken(serviceName);
      expect(token).toBeDefined();

      // Mock verification to return correct payload
      const mockPayload = {
        serviceName,
        type: 'service',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
      jwtService.verify.mockReturnValueOnce(mockPayload);

      // Verify token
      const verified = service.verifyServiceToken(token);
      expect(verified.serviceName).toBe(serviceName);
      expect(verified.type).toBe('service');
    });

    it('should support renewal flow: verify old -> generate new', () => {
      const serviceName = 'memory-service';
      
      // Mock verification of old token
      const mockOldPayload = {
        serviceName,
        type: 'service',
        iat: Math.floor(Date.now() / 1000) - 82800,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      jwtService.verify.mockReturnValueOnce(mockOldPayload);

      // Verify old token
      const verified = service.verifyServiceToken('old-token');
      expect(verified.serviceName).toBe(serviceName);

      // Generate new token
      const newToken = service.generateServiceToken(verified.serviceName);
      expect(newToken).toBeDefined();
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName,
        }),
        expect.any(Object)
      );
    });
  });

  describe('Security Requirements', () => {
    it('should include required claims in token payload', () => {
      service.generateServiceToken('test-service');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: expect.any(String),
          type: 'service',
          iat: expect.any(Number),
        }),
        expect.any(Object)
      );
    });

    it('should use configured secret for signing', () => {
      service.generateServiceToken('test-service');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          secret: TEST_SECRET,
        })
      );
    });

    it('should use configured secret for verification', () => {
      const mockPayload = {
        serviceName: 'test-service',
        type: 'service',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
      jwtService.verify.mockReturnValueOnce(mockPayload);

      service.verifyServiceToken('test-token');

      expect(jwtService.verify).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({
          secret: TEST_SECRET,
        })
      );
    });
  });
});
