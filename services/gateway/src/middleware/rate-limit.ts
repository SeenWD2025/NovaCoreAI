/**
 * Rate Limiting Middleware
 * Limits the number of requests per IP address
 */
import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // requests per window

/**
 * Clean up old entries from store
 */
const cleanupStore = () => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
};

// Run cleanup every 5 minutes (and unref to avoid hanging tests)
const cleanupInterval = setInterval(cleanupStore, 5 * 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = req.ip || 'unknown';
  const now = Date.now();

  // Initialize or get existing record
  if (!store[clientIp]) {
    store[clientIp] = {
      count: 0,
      resetTime: now + WINDOW_MS,
    };
  }

  const record = store[clientIp];

  // Reset if window has passed
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + WINDOW_MS;
  }

  // Increment count
  record.count++;

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - record.count));
  
  // Check if over limit
  if (record.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    });
    return;
  }

  next();
};
