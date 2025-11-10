/**
 * Correlation ID middleware for request tracing
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface CorrelationRequest extends Request {
  correlationId?: string;
}

/**
 * Middleware to generate or extract correlation IDs
 * Adds X-Correlation-ID header to requests and responses
 */
export function correlationIdMiddleware(req: CorrelationRequest, res: Response, next: NextFunction) {
  // Get correlation ID from header or generate new one
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  // Attach to request object
  req.correlationId = correlationId;
  
  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
}
