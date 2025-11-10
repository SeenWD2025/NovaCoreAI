import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

/**
 * Service-to-Service Authentication Service
 * Handles JWT token generation and verification for inter-service communication
 */
@Injectable()
export class ServiceAuthService {
  private readonly SERVICE_JWT_SECRET: string;
  private readonly TOKEN_EXPIRATION = '24h'; // 24 hour expiration as per requirements

  constructor(private readonly jwtService: JwtService) {
    this.SERVICE_JWT_SECRET = process.env.SERVICE_JWT_SECRET || '';
    
    if (!this.SERVICE_JWT_SECRET) {
      console.warn('WARNING: SERVICE_JWT_SECRET not set. Service authentication will not work properly!');
    }
  }

  /**
   * Generate a service-to-service JWT token
   * @param serviceName Name of the service requesting the token
   * @returns JWT token string
   */
  generateServiceToken(serviceName: string): string {
    if (!this.SERVICE_JWT_SECRET) {
      throw new Error('SERVICE_JWT_SECRET is not configured');
    }

    const payload = {
      serviceName,
      type: 'service',
      iat: Math.floor(Date.now() / 1000),
    };

    return this.jwtService.sign(payload, {
      secret: this.SERVICE_JWT_SECRET,
      expiresIn: this.TOKEN_EXPIRATION,
    });
  }

  /**
   * Verify a service-to-service JWT token
   * @param token JWT token to verify
   * @returns Decoded token payload
   * @throws UnauthorizedException if token is invalid
   */
  verifyServiceToken(token: string): { serviceName: string; type: string; iat: number; exp: number } {
    if (!this.SERVICE_JWT_SECRET) {
      throw new UnauthorizedException('Service authentication not configured');
    }

    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.SERVICE_JWT_SECRET,
      });

      if (decoded.type !== 'service') {
        throw new UnauthorizedException('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Service token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid service token');
      }
      throw new UnauthorizedException('Service token verification failed');
    }
  }

  /**
   * Check if a token is about to expire (within 1 hour)
   * @param token JWT token to check
   * @returns true if token should be renewed
   */
  shouldRenewToken(token: string): boolean {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.SERVICE_JWT_SECRET,
        ignoreExpiration: true, // Check expiration manually
      });

      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - now;
      
      // Renew if less than 1 hour until expiration
      return timeUntilExpiry < 3600;
    } catch (error) {
      return true; // If we can't decode, should renew
    }
  }
}
