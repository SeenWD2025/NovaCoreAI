/**
 * Metrics tracking middleware
 */
import { Request, Response, NextFunction } from 'express';
import { gatewayRequestsTotal, gatewayLatencySeconds } from '../metrics';

interface MetricsRequest extends Request {
  _startTime?: number;
}

/**
 * Middleware to track request metrics
 */
export function metricsMiddleware(req: MetricsRequest, res: Response, next: NextFunction) {
  // Record start time
  req._startTime = Date.now();

  // Track when response is finished
  res.on('finish', () => {
    const duration = (Date.now() - (req._startTime || Date.now())) / 1000;
    const route = getRoutePattern(req.path);
    
    // Track total requests
    gatewayRequestsTotal.labels({
      method: req.method,
      route: route,
      status_code: res.statusCode.toString()
    }).inc();

    // Track latency
    gatewayLatencySeconds.labels({
      route: route,
      method: req.method
    }).observe(duration);
  });

  next();
}

/**
 * Normalize route paths to patterns for better metric aggregation
 * Example: /api/chat/abc-123-def -> /api/chat/:id
 */
function getRoutePattern(path: string): string {
  // Normalize common patterns
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
    .replace(/\/[0-9]+/g, '/:id') // Numeric IDs
    .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token'); // Long tokens/hashes
}
