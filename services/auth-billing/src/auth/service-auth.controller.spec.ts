import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ServiceAuthController } from './service-auth.controller';
import { ServiceAuthService } from './service-auth.service';

describe('ServiceAuthController', () => {
  let controller: ServiceAuthController;
  let serviceAuthService: jest.Mocked<ServiceAuthService>;

  beforeEach(async () => {
    const mockServiceAuthService = {
      generateServiceToken: jest.fn(),
      verifyServiceToken: jest.fn(),
      shouldRenewToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceAuthController],
      providers: [
        {
          provide: ServiceAuthService,
          useValue: mockServiceAuthService,
        },
      ],
    }).compile();

    controller = module.get<ServiceAuthController>(ServiceAuthController);
    serviceAuthService = module.get(ServiceAuthService) as jest.Mocked<ServiceAuthService>;
  });

  describe('Token Generation Endpoint', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should generate token for valid service name', async () => {
      const serviceName = 'intelligence';
      const mockToken = 'mock.jwt.token';
      serviceAuthService.generateServiceToken.mockReturnValue(mockToken);

      const result = await controller.generateToken({ serviceName });

      expect(result).toEqual({
        token: mockToken,
        expiresIn: '24h',
      });
      expect(serviceAuthService.generateServiceToken).toHaveBeenCalledWith(serviceName);
    });

    it('should throw UnauthorizedException if service name is missing', async () => {
      await expect(
        controller.generateToken({ serviceName: '' })
      ).rejects.toThrow(UnauthorizedException);
      
      await expect(
        controller.generateToken({ serviceName: '' })
      ).rejects.toThrow('Service name is required');
    });

    it('should throw UnauthorizedException for invalid service name', async () => {
      await expect(
        controller.generateToken({ serviceName: 'invalid-service' })
      ).rejects.toThrow(UnauthorizedException);
      
      await expect(
        controller.generateToken({ serviceName: 'invalid-service' })
      ).rejects.toThrow('Invalid service name');
    });

    it('should accept all valid service names', async () => {
      const validServices = [
        'gateway',
        'intelligence',
        'memory',
        'noble-spirit',
        'ngs-curriculum',
        'reflection-worker',
        'distillation-worker',
      ];

      serviceAuthService.generateServiceToken.mockReturnValue('mock.token');

      for (const serviceName of validServices) {
        const result = await controller.generateToken({ serviceName });
        expect(result.token).toBe('mock.token');
        expect(result.expiresIn).toBe('24h');
      }

      expect(serviceAuthService.generateServiceToken).toHaveBeenCalledTimes(validServices.length);
    });

    it('should reject service names not in whitelist', async () => {
      const invalidServices = [
        'unknown-service',
        'hacker-service',
        'external-api',
        '',
        'INTELLIGENCE', // Case sensitive
      ];

      for (const serviceName of invalidServices) {
        if (serviceName === '') {
          await expect(
            controller.generateToken({ serviceName })
          ).rejects.toThrow('Service name is required');
        } else {
          await expect(
            controller.generateToken({ serviceName })
          ).rejects.toThrow('Invalid service name');
        }
      }
    });
  });

  describe('Token Refresh Endpoint', () => {
    it('should refresh token with valid current token', async () => {
      const currentToken = 'current.jwt.token';
      const newToken = 'new.jwt.token';
      const mockDecoded = {
        serviceName: 'intelligence',
        type: 'service',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };

      serviceAuthService.verifyServiceToken.mockReturnValue(mockDecoded);
      serviceAuthService.generateServiceToken.mockReturnValue(newToken);

      const result = await controller.refreshToken(currentToken);

      expect(result).toEqual({
        token: newToken,
        expiresIn: '24h',
      });
      expect(serviceAuthService.verifyServiceToken).toHaveBeenCalledWith(currentToken);
      expect(serviceAuthService.generateServiceToken).toHaveBeenCalledWith('intelligence');
    });

    it('should throw UnauthorizedException if current token is missing', async () => {
      await expect(
        controller.refreshToken('')
      ).rejects.toThrow(UnauthorizedException);
      
      await expect(
        controller.refreshToken('')
      ).rejects.toThrow('Current service token is required');
    });

    it('should throw UnauthorizedException if current token is invalid', async () => {
      const invalidToken = 'invalid.token';
      serviceAuthService.verifyServiceToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid service token');
      });

      await expect(
        controller.refreshToken(invalidToken)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if current token is expired', async () => {
      const expiredToken = 'expired.token';
      serviceAuthService.verifyServiceToken.mockImplementation(() => {
        throw new UnauthorizedException('Service token has expired');
      });

      await expect(
        controller.refreshToken(expiredToken)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should generate new token with same service name as old token', async () => {
      const currentToken = 'current.token';
      const services = ['gateway', 'intelligence', 'memory'];

      for (const serviceName of services) {
        const mockDecoded = {
          serviceName,
          type: 'service',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
        };
        serviceAuthService.verifyServiceToken.mockReturnValue(mockDecoded);
        serviceAuthService.generateServiceToken.mockReturnValue('new.token');

        await controller.refreshToken(currentToken);

        expect(serviceAuthService.generateServiceToken).toHaveBeenCalledWith(serviceName);
      }
    });
  });

  describe('Token Verification Endpoint', () => {
    it('should verify valid token', async () => {
      const validToken = 'valid.jwt.token';
      const mockDecoded = {
        serviceName: 'memory',
        type: 'service',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };

      serviceAuthService.verifyServiceToken.mockReturnValue(mockDecoded);

      const result = await controller.verifyToken(validToken);

      expect(result).toEqual({
        valid: true,
        serviceName: 'memory',
      });
      expect(serviceAuthService.verifyServiceToken).toHaveBeenCalledWith(validToken);
    });

    it('should return invalid for expired token', async () => {
      const expiredToken = 'expired.token';
      serviceAuthService.verifyServiceToken.mockImplementation(() => {
        throw new UnauthorizedException('Service token has expired');
      });

      const result = await controller.verifyToken(expiredToken);

      expect(result).toEqual({
        valid: false,
      });
    });

    it('should return invalid for malformed token', async () => {
      const malformedToken = 'malformed.token';
      serviceAuthService.verifyServiceToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid service token');
      });

      const result = await controller.verifyToken(malformedToken);

      expect(result).toEqual({
        valid: false,
      });
    });

    it('should throw UnauthorizedException if token is missing', async () => {
      await expect(
        controller.verifyToken('')
      ).rejects.toThrow(UnauthorizedException);
      
      await expect(
        controller.verifyToken('')
      ).rejects.toThrow('Service token is required');
    });

    it('should return service name for valid tokens', async () => {
      const services = ['gateway', 'intelligence', 'memory', 'noble-spirit'];

      for (const serviceName of services) {
        const mockDecoded = {
          serviceName,
          type: 'service',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
        };
        serviceAuthService.verifyServiceToken.mockReturnValue(mockDecoded);

        const result = await controller.verifyToken('token');

        expect(result.valid).toBe(true);
        expect(result.serviceName).toBe(serviceName);
      }
    });

    it('should handle any verification errors gracefully', async () => {
      serviceAuthService.verifyServiceToken.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await controller.verifyToken('problematic.token');

      expect(result).toEqual({
        valid: false,
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should support full token lifecycle: generate -> verify -> refresh', async () => {
      const serviceName = 'intelligence';
      const token1 = 'first.token';
      const token2 = 'second.token';

      // Generate initial token
      serviceAuthService.generateServiceToken.mockReturnValueOnce(token1);
      const generateResult = await controller.generateToken({ serviceName });
      expect(generateResult.token).toBe(token1);

      // Verify token
      const mockDecoded = {
        serviceName,
        type: 'service',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
      serviceAuthService.verifyServiceToken.mockReturnValueOnce(mockDecoded);
      const verifyResult = await controller.verifyToken(token1);
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.serviceName).toBe(serviceName);

      // Refresh token
      serviceAuthService.verifyServiceToken.mockReturnValueOnce(mockDecoded);
      serviceAuthService.generateServiceToken.mockReturnValueOnce(token2);
      const refreshResult = await controller.refreshToken(token1);
      expect(refreshResult.token).toBe(token2);
    });

    it('should reject tokens after refresh is called', async () => {
      const serviceName = 'memory';
      const oldToken = 'old.token';
      const newToken = 'new.token';

      // Initial token verification succeeds
      const mockDecoded = {
        serviceName,
        type: 'service',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
      serviceAuthService.verifyServiceToken.mockReturnValueOnce(mockDecoded);
      serviceAuthService.generateServiceToken.mockReturnValueOnce(newToken);
      
      await controller.refreshToken(oldToken);

      // Old token should now be invalid (simulate revocation)
      serviceAuthService.verifyServiceToken.mockImplementationOnce(() => {
        throw new UnauthorizedException('Token has been revoked');
      });

      const result = await controller.verifyToken(oldToken);
      expect(result.valid).toBe(false);
    });
  });

  describe('Security Validations', () => {
    it('should enforce service name whitelist', async () => {
      const validServices = [
        'gateway',
        'intelligence',
        'memory',
        'noble-spirit',
        'ngs-curriculum',
        'reflection-worker',
        'distillation-worker',
      ];

      // All valid services should work
      serviceAuthService.generateServiceToken.mockReturnValue('token');
      for (const serviceName of validServices) {
        await expect(
          controller.generateToken({ serviceName })
        ).resolves.toBeDefined();
      }

      // Invalid services should be rejected
      await expect(
        controller.generateToken({ serviceName: 'unauthorized-service' })
      ).rejects.toThrow('Invalid service name');
    });

    it('should require authentication for refresh endpoint', async () => {
      await expect(
        controller.refreshToken('')
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.refreshToken(undefined as any)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should require authentication for verify endpoint', async () => {
      await expect(
        controller.verifyToken('')
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.verifyToken(undefined as any)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return 24h expiration for all tokens', async () => {
      const services = ['gateway', 'intelligence', 'memory'];
      serviceAuthService.generateServiceToken.mockReturnValue('token');

      for (const serviceName of services) {
        const result = await controller.generateToken({ serviceName });
        expect(result.expiresIn).toBe('24h');
      }

      const mockDecoded = {
        serviceName: 'test',
        type: 'service',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
      serviceAuthService.verifyServiceToken.mockReturnValue(mockDecoded);
      serviceAuthService.generateServiceToken.mockReturnValue('new-token');

      const refreshResult = await controller.refreshToken('old-token');
      expect(refreshResult.expiresIn).toBe('24h');
    });
  });
});
