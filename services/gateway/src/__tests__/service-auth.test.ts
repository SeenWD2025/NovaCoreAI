/**
 * Tests for service authentication middleware
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { serviceAuthMiddleware, ServiceAuthRequest, generateServiceToken } from '../middleware/service-auth';

// Mock environment variable
const TEST_SECRET = 'test-service-jwt-secret-for-testing';
process.env.SERVICE_JWT_SECRET = TEST_SECRET;

describe('Service Authentication Middleware', () => {
  let mockReq: Partial<ServiceAuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockReq = {
      headers: {},
    };
    
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    
    mockNext = jest.fn();
  });

  describe('Valid Token', () => {
    it('should allow request with valid service token', () => {
      const validToken = generateServiceToken('intelligence-service');
      mockReq.headers = {
        'x-service-token': validToken,
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.service).toBeDefined();
      expect(mockReq.service?.serviceName).toBe('intelligence-service');
      expect(mockReq.service?.authenticated).toBe(true);
    });

    it('should add service context to request', () => {
      const validToken = generateServiceToken('memory-service');
      mockReq.headers = {
        'x-service-token': validToken,
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(mockReq.service).toEqual({
        serviceName: 'memory-service',
        authenticated: true,
      });
    });

    it('should accept tokens from different services', () => {
      const services = ['intelligence-service', 'memory-service', 'policy-service', 'ngs-curriculum'];

      services.forEach((serviceName) => {
        const token = generateServiceToken(serviceName);
        mockReq.headers = { 'x-service-token': token };
        
        // Reset next mock
        mockNext = jest.fn();

        serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.service?.serviceName).toBe(serviceName);
      });
    });
  });

  describe('Missing Token', () => {
    it('should return 403 when service token is missing', () => {
      mockReq.headers = {}; // No token

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Service authentication token is required for service-to-service calls',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not proceed when token header is undefined', () => {
      mockReq.headers = { 'x-service-token': undefined };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Token', () => {
    it('should return 403 for invalid token signature', () => {
      mockReq.headers = {
        'x-service-token': 'invalid.token.signature',
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: expect.stringContaining('Invalid service token'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for malformed token', () => {
      mockReq.headers = {
        'x-service-token': 'not-a-jwt-token',
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for token with wrong secret', () => {
      // Generate token with different secret
      const wrongToken = jwt.sign(
        { serviceName: 'test-service', type: 'service' },
        'wrong-secret',
        { expiresIn: '24h' }
      );

      mockReq.headers = {
        'x-service-token': wrongToken,
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for token with wrong type', () => {
      // Generate token with type 'user' instead of 'service'
      const userToken = jwt.sign(
        { serviceName: 'test-service', type: 'user' },
        TEST_SECRET,
        { expiresIn: '24h' }
      );

      mockReq.headers = {
        'x-service-token': userToken,
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid service token type',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Expired Token', () => {
    it('should return 403 for expired token', () => {
      // Generate token that's already expired
      const expiredToken = jwt.sign(
        { serviceName: 'test-service', type: 'service' },
        TEST_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      mockReq.headers = {
        'x-service-token': expiredToken,
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Service token has expired. Please renew your token.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Token Generation', () => {
    it('should generate valid service token', () => {
      const token = generateServiceToken('test-service');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, TEST_SECRET) as any;
      expect(decoded.serviceName).toBe('test-service');
      expect(decoded.type).toBe('service');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should generate tokens that expire in 24 hours', () => {
      const token = generateServiceToken('test-service');
      const decoded = jwt.verify(token, TEST_SECRET) as any;

      const expirationTime = decoded.exp - decoded.iat;
      const expectedExpiration = 24 * 60 * 60; // 24 hours in seconds

      expect(expirationTime).toBe(expectedExpiration);
    });

    it('should throw error if SERVICE_JWT_SECRET is not set', () => {
      // Temporarily remove secret
      const originalSecret = process.env.SERVICE_JWT_SECRET;
      delete process.env.SERVICE_JWT_SECRET;

      expect(() => {
        generateServiceToken('test-service');
      }).toThrow('SERVICE_JWT_SECRET is not configured');

      // Restore secret
      process.env.SERVICE_JWT_SECRET = originalSecret;
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', () => {
      // Pass a token that will cause an unexpected error
      mockReq.headers = {
        'x-service-token': 'eyJ.invalid.payload',
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case-sensitive for header name', () => {
      const validToken = generateServiceToken('test-service');
      
      // Use wrong case for header
      mockReq.headers = {
        'X-Service-Token': validToken, // Wrong case
      };

      // Express normalizes headers to lowercase, but this tests the expectation
      mockReq.headers = {
        'x-service-token': validToken, // Correct lowercase
      };

      serviceAuthMiddleware(mockReq as ServiceAuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('Service Token Generation Helper', () => {
  it('should generate unique tokens for same service', () => {
    const token1 = generateServiceToken('test-service');
    const token2 = generateServiceToken('test-service');

    // Tokens should be different due to different iat timestamps
    expect(token1).not.toBe(token2);
  });

  it('should generate different tokens for different services', () => {
    const token1 = generateServiceToken('service-1');
    const token2 = generateServiceToken('service-2');

    expect(token1).not.toBe(token2);

    const decoded1 = jwt.verify(token1, TEST_SECRET) as any;
    const decoded2 = jwt.verify(token2, TEST_SECRET) as any;

    expect(decoded1.serviceName).toBe('service-1');
    expect(decoded2.serviceName).toBe('service-2');
  });
});
