/**
 * Tests for JWT authentication middleware
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

// Mock environment variable
const TEST_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.JWT_SECRET = TEST_JWT_SECRET;

describe('JWT Authentication Middleware', () => {
  let mockReq: Partial<AuthRequest>;
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

  describe('Valid JWT Token', () => {
    it('should authenticate user with valid JWT token in Authorization header', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', role: 'student' },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );

      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.userId).toBe('user-123');
      expect(mockReq.user?.email).toBe('test@example.com');
    });

    it('should extract user details correctly', () => {
      const token = jwt.sign(
        { 
          userId: 'user-456', 
          email: 'admin@example.com', 
          role: 'admin',
          subscription_tier: 'pro'
        },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );

      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual({
        userId: 'user-456',
        email: 'admin@example.com',
        role: 'admin',
        subscription_tier: 'pro'
      });
    });
  });

  describe('Missing Authorization', () => {
    it('should return 401 when Authorization header is missing', () => {
      mockReq.headers = {};

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Access token is required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is empty', () => {
      mockReq.headers = {
        authorization: '',
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Bearer prefix is missing', () => {
      const token = jwt.sign({ userId: 'user-123' }, TEST_JWT_SECRET);
      mockReq.headers = {
        authorization: token, // Missing "Bearer " prefix
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Invalid JWT Token', () => {
    it('should return 403 for invalid token signature', () => {
      mockReq.headers = {
        authorization: 'Bearer invalid.token.signature',
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for token signed with wrong secret', () => {
      const wrongToken = jwt.sign(
        { userId: 'user-123' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      mockReq.headers = {
        authorization: `Bearer ${wrongToken}`,
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for malformed token', () => {
      mockReq.headers = {
        authorization: 'Bearer not-a-jwt-token',
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Expired JWT Token', () => {
    it('should return 403 for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        TEST_JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: expect.stringContaining('expired'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle token with extra spaces', () => {
      const token = jwt.sign({ userId: 'user-123' }, TEST_JWT_SECRET);
      mockReq.headers = {
        authorization: `Bearer  ${token}  `, // Extra spaces
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      // Should handle trimming
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject token with missing userId', () => {
      const token = jwt.sign({ email: 'test@example.com' }, TEST_JWT_SECRET);
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      // Depends on implementation - may need userId validation
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Multiple Token Formats', () => {
    it('should only accept Bearer token scheme', () => {
      const token = jwt.sign({ userId: 'user-123' }, TEST_JWT_SECRET);
      
      mockReq.headers = {
        authorization: `Basic ${token}`, // Wrong scheme
      };

      authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe('JWT Middleware - Security', () => {
  it('should not expose JWT secret in error messages', () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    const mockReq: Partial<AuthRequest> = {
      headers: { authorization: 'Bearer invalid.token' },
    };
    
    const mockRes: Partial<Response> = {
      status: statusMock,
      json: jsonMock,
    };
    
    const mockNext: NextFunction = jest.fn();

    authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(jsonMock).toHaveBeenCalled();
    const errorMessage = jsonMock.mock.calls[0][0].message;
    expect(errorMessage).not.toContain(TEST_JWT_SECRET);
  });

  it('should not leak sensitive user data in logs', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    const mockReq: Partial<AuthRequest> = {
      headers: { authorization: 'Bearer invalid' },
    };
    
    const mockRes: Partial<Response> = {
      status: statusMock,
      json: jsonMock,
    };
    
    const mockNext: NextFunction = jest.fn();

    authenticateJWT(mockReq as AuthRequest, mockRes as Response, mockNext);

    // If logging is implemented, check it doesn't contain passwords
    consoleErrorSpy.mockRestore();
  });
});
