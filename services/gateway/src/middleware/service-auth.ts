import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface ServiceTokenPayload {
  serviceName: string;
  type: string;
  iat: number;
  exp: number;
}

/**
 * Extended Request interface to include service context
 */
export interface ServiceAuthRequest extends Request {
  service?: {
    serviceName: string;
    authenticated: boolean;
  };
}

/**
 * Middleware to validate service-to-service authentication tokens
 * This middleware verifies the X-Service-Token header and ensures only
 * authenticated services can make requests
 */
export const serviceAuthMiddleware = (req: ServiceAuthRequest, res: Response, next: NextFunction) => {
  const SERVICE_JWT_SECRET = process.env.SERVICE_JWT_SECRET || '';
  const serviceToken = req.headers['x-service-token'] as string;

  if (!serviceToken) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Service authentication token is required for service-to-service calls',
    });
  }

  if (!SERVICE_JWT_SECRET) {
    console.error('SERVICE_JWT_SECRET is not configured');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Service authentication is not properly configured',
    });
  }

  try {
    const decoded = jwt.verify(serviceToken, SERVICE_JWT_SECRET) as ServiceTokenPayload;

    // Verify token type is 'service'
    if (decoded.type !== 'service') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid service token type',
      });
    }

    // Add service context to request
    req.service = {
      serviceName: decoded.serviceName,
      authenticated: true,
    };

    // Log service authentication for audit
    console.log(`Service authenticated: ${decoded.serviceName} at ${new Date().toISOString()}`);

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Service token has expired. Please renew your token.',
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid service token',
      });
    }

    console.error('Service authentication error:', error);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Service token verification failed',
    });
  }
};

/**
 * Helper function to generate a service token (for testing/development)
 * In production, services should request tokens from the auth service
 */
export const generateServiceToken = (serviceName: string): string => {
  const SERVICE_JWT_SECRET = process.env.SERVICE_JWT_SECRET || '';
  
  if (!SERVICE_JWT_SECRET) {
    throw new Error('SERVICE_JWT_SECRET is not configured');
  }

  const payload = {
    serviceName,
    type: 'service',
    // iat will be added automatically by jwt.sign
    jti: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique token ID
  };

  return jwt.sign(payload, SERVICE_JWT_SECRET, { expiresIn: '24h' });
};
