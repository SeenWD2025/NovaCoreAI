/**
 * JWT Authentication Middleware
 * Validates user JWT tokens from the Authorization header
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    subscription_tier?: string;
  };
}

/**
 * Middleware to authenticate JWT tokens
 * Expects: Authorization: Bearer <token>
 */
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required',
    });
    return;
  }

  // Extract token from "Bearer <token>"
  const parts = authHeader.trim().split(/\s+/); // Split by any whitespace
  
  if (parts.length < 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required',
    });
    return;
  }

  const token = parts[1].trim();

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    req.user = {
      userId: decoded.userId || decoded.sub || '',
      email: decoded.email || '',
      role: decoded.role || 'user',
      ...(decoded.subscription_tier && { subscription_tier: decoded.subscription_tier }),
    };
    
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Token has expired',
      });
      return;
    }
    
    if (err.name === 'JsonWebTokenError') {
      // Check if it's an expiration-related error in the message
      if (err.message && err.message.toLowerCase().includes('expired')) {
        res.status(403).json({
          error: 'Forbidden',
          message: err.message,
        });
        return;
      }
      
      res.status(403).json({
        error: 'Forbidden',
        message: err.message,
      });
      return;
    }
    
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid token',
    });
  }
};

/**
 * Optional authentication middleware
 * Validates token if present, but allows request to proceed without one
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return next();
  }

  const parts = authHeader.trim().split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next();
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    req.user = {
      userId: decoded.userId || decoded.sub || '',
      email: decoded.email || '',
      role: decoded.role || 'user',
      ...(decoded.subscription_tier && { subscription_tier: decoded.subscription_tier }),
    };
  } catch (err) {
    // Ignore errors for optional auth
  }
  
  next();
};
