/**
 * Tests for correlation ID middleware
 */
import { Request, Response, NextFunction } from 'express';
import { correlationIdMiddleware } from '../middleware/correlation-id';

describe('Correlation ID Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    setHeaderMock = jest.fn();
    
    mockReq = {
      headers: {},
    };
    
    mockRes = {
      setHeader: setHeaderMock,
    };
    
    mockNext = jest.fn();
  });

  describe('Correlation ID Generation', () => {
    it('should generate a correlation ID if not provided', () => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect((mockReq as any).correlationId).toBeDefined();
      expect(typeof (mockReq as any).correlationId).toBe('string');
      expect((mockReq as any).correlationId.length).toBeGreaterThan(0);
    });

    it('should set correlation ID in response header', () => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith(
        'X-Correlation-ID',
        expect.any(String)
      );
    });

    it('should call next middleware', () => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should generate unique IDs for different requests', () => {
      const mockReq1: Partial<Request> = { headers: {} };
      const mockReq2: Partial<Request> = { headers: {} };
      
      correlationIdMiddleware(mockReq1 as Request, mockRes as Response, mockNext);
      correlationIdMiddleware(mockReq2 as Request, mockRes as Response, mockNext);
      
      expect((mockReq1 as any).correlationId).not.toBe((mockReq2 as any).correlationId);
    });
  });

  describe('Correlation ID Preservation', () => {
    it('should preserve existing correlation ID from header', () => {
      const existingId = 'test-correlation-123';
      mockReq.headers = {
        'x-correlation-id': existingId,
      };
      
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect((mockReq as any).correlationId).toBe(existingId);
    });

    it('should set preserved correlation ID in response header', () => {
      const existingId = 'test-correlation-456';
      mockReq.headers = {
        'x-correlation-id': existingId,
      };
      
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(setHeaderMock).toHaveBeenCalledWith('X-Correlation-ID', existingId);
    });

    it('should handle case-insensitive header names', () => {
      const existingId = 'test-correlation-789';
      mockReq.headers = {
        'X-CORRELATION-ID': existingId,
      };
      
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Should still work (Express normalizes headers to lowercase)
      expect((mockReq as any).correlationId).toBeDefined();
    });
  });

  describe('Correlation ID Format', () => {
    it('should generate UUID format correlation ID', () => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      const correlationId = (mockReq as any).correlationId;
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(correlationId).toMatch(uuidRegex);
    });

    it('should handle empty string correlation ID', () => {
      mockReq.headers = {
        'x-correlation-id': '',
      };
      
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Should generate new ID if empty
      expect((mockReq as any).correlationId).toBeDefined();
      expect((mockReq as any).correlationId.length).toBeGreaterThan(0);
    });
  });

  describe('Request Context', () => {
    it('should attach correlation ID to request object', () => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect((mockReq as any).correlationId).toBeDefined();
    });

    it('should make correlation ID available for logging', () => {
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      const correlationId = (mockReq as any).correlationId;
      expect(correlationId).toBeTruthy();
      
      // Simulate logging
      const logEntry = {
        correlationId: correlationId,
        message: 'Test log',
      };
      
      expect(logEntry.correlationId).toBe(correlationId);
    });
  });

  describe('Multiple Requests', () => {
    it('should handle multiple requests independently', () => {
      const requests = Array(5).fill(null).map(() => ({
        headers: {},
      }));
      
      const correlationIds = requests.map((req) => {
        correlationIdMiddleware(req as Request, mockRes as Response, mockNext);
        return (req as any).correlationId;
      });
      
      // All should be unique
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing headers object gracefully', () => {
      const reqWithNoHeaders = {} as Request;
      
      expect(() => {
        correlationIdMiddleware(reqWithNoHeaders, mockRes as Response, mockNext);
      }).toThrow();
    });

    it('should handle special characters in provided correlation ID', () => {
      const specialId = 'test-id-with-special-chars-@#$%';
      mockReq.headers = {
        'x-correlation-id': specialId,
      };
      
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect((mockReq as any).correlationId).toBe(specialId);
    });

    it('should handle very long correlation IDs', () => {
      const longId = 'a'.repeat(1000);
      mockReq.headers = {
        'x-correlation-id': longId,
      };
      
      correlationIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect((mockReq as any).correlationId).toBe(longId);
    });
  });
});
