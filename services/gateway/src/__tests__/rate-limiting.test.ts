/**
 * Tests for rate limiting middleware
 */
import { Request, Response, NextFunction } from 'express';
import { rateLimitMiddleware } from '../middleware/rate-limit';

describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    setHeaderMock = jest.fn();
    
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
    };
    
    mockRes = {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
    };
    
    mockNext = jest.fn();
  });

  describe('Within Rate Limit', () => {
    it('should allow requests within rate limit', () => {
      rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should set rate limit headers', () => {
      rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(setHeaderMock).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    });
  });

  describe('Exceeding Rate Limit', () => {
    it('should return 429 when rate limit exceeded', () => {
      // Make multiple requests to exceed limit
      for (let i = 0; i < 150; i++) {
        rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }
      
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
        })
      );
    });

    it('should include retry-after header', () => {
      // Exceed rate limit
      for (let i = 0; i < 150; i++) {
        rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }
      
      expect(setHeaderMock).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

  describe('Different IPs', () => {
    it('should track rate limits separately per IP', () => {
      const ip1Req = { ...mockReq, ip: '192.168.1.1' };
      const ip2Req = { ...mockReq, ip: '192.168.1.2' };
      
      // Make requests from different IPs
      rateLimitMiddleware(ip1Req as Request, mockRes as Response, mockNext);
      rateLimitMiddleware(ip2Req as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });
});
